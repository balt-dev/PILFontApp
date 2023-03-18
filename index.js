const input = document.getElementById("file");
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function openFiles() {
    return new Promise((resolve, reject) => {
        input.onchange = _ => {
            if (input.files?.length !== 2) {
                reject("Wrong amount of files selected");
            }
            resolve(input.files);
        };
        input.click();
    });
}

function check(slice, value) {
    let sliceArr = new Uint8Array(slice);
    let valueArr = encoder.encode(value);
    if (sliceArr.byteLength != valueArr.byteLength) return false;
    for (let i = 0; i < sliceArr.byteLength; i++) {
        if (sliceArr[i] != valueArr[i]) return false;
    }
    return true;
}

function loadFont(buf) {
    // Load font to object
    let index = 0;

    function pop(len) {
        return buf.slice(index, index += len);
    }
    let font = {
        "glyphs": new Array(256)
    };
    font.glyphs.fill(null);
    Object.seal(font.glyphs);
    if (!check(pop(14), "PILfont\n;;;;;;")) {
        alert("Error while parsing font: Incorrect header");
        return null;
    }
    let num_arr = [];
    let char = new Uint8Array(pop(1))[0];
    while (0x30 <= char & char < 0x3A) {
        num_arr.push(char);
        char = new Uint8Array(pop(1))[0];
    }
    index -= 1;
    num_arr = new Uint8Array(num_arr);
    font.ysize = parseInt(decoder.decode(num_arr), 10);
    if (!check(pop(7), ";\nDATA\n")) {
        alert("Error while parsing font: Incorrect header");
        return null;
    }
    buf = buf.slice(index);
    index = 0;
    let view = new DataView(buf);
    for (let i = 0; i < 256; i++) {
        let glyph = {};
        let dx = view.getInt16(0 + i * 20);
        let dy = view.getInt16(2 + i * 20);
        let dx0 = view.getInt16(4 + i * 20);
        let dy0 = view.getInt16(6 + i * 20);
        let dx1 = view.getInt16(8 + i * 20);
        let dy1 = view.getInt16(10 + i * 20);
        let sx0 = view.getInt16(12 + i * 20);
        let sy0 = view.getInt16(14 + i * 20);
        let sx1 = view.getInt16(16 + i * 20);
        let sy1 = view.getInt16(18 + i * 20);
        glyph.delta = {
            "x": dx,
            "y": dy
        };
        glyph.dstBBox = {
            "x": dx0,
            "y": dy0,
            "u": dx1,
            "v": dy1
        };
        glyph.srcBBox = {
            "x": sx0,
            "y": sy0,
            "u": sx1,
            "v": sy1
        };
        glyph.character = String.fromCharCode(i);
        font.glyphs[i] = glyph;
    }
    return font;
}

let offset = {"x": 0, "y": 0};
let zoom = 1.0;

// For if the user is using a trackpad

const mouseWheel = {"x": 0, "y": 0};

let wheelTimeout;
let initialZoom = zoom;
window.addEventListener("wheel", (event) => {
    clearTimeout(wheelTimeout);
    if (event.ctrlKey) {
        initialZoom -= event.deltaY / 10;
        zoom = Math.min(16, Math.max(1, Math.floor(initialZoom)));
    } else {
        mouseWheel.x = -event.deltaX / zoom;
        mouseWheel.y = -event.deltaY / zoom;
    }
    wheelTimeout = setTimeout(()=>{
        mouseWheel.x = 0; mouseWheel.y = 0; initialZoom = zoom;
    }, 20);
}, false);

// For if the user has a touchscreen

let initOffset;
let initZoom;
const initTouch = {"bbox": null, "meanPos": null};
const touch = {"bbox": null, "meanPos": null};


window.addEventListener("touchstart", function (e) {
    e.preventDefault();
    initOffset = {"x": -offset.x, "y": -offset.y};
    initZoom = zoom;
    initTouch.bbox = {"x": Infinity, "y": Infinity, "u": -Infinity, "v": -Infinity};
    for (let i = 0; i < e.touches.length; i++) {
        let t = e.touches[i];
        initTouch.bbox.x = Math.min(initTouch.bbox.x, t.clientX);
        initTouch.bbox.y = Math.min(initTouch.bbox.y, t.clientY);
        initTouch.bbox.u = Math.max(initTouch.bbox.u, t.clientX);
        initTouch.bbox.v = Math.max(initTouch.bbox.v, t.clientY);
    }
    initTouch.meanPos = {
        "x": (initTouch.bbox.x + initTouch.bbox.u) / 2,
        "y": (initTouch.bbox.y + initTouch.bbox.v) / 2
    };
});

window.addEventListener("touchmove", function (e) {
    e.preventDefault();
    touch.bbox = {"x": Infinity, "y": Infinity, "u": -Infinity, "v": -Infinity};
    for (let t of Array.from(e.touches)) {
        touch.bbox.x = Math.min(touch.bbox.x, t.clientX);
        touch.bbox.y = Math.min(touch.bbox.y, t.clientY);
        touch.bbox.u = Math.max(touch.bbox.u, t.clientX);
        touch.bbox.v = Math.max(touch.bbox.v, t.clientY);
    }
    touch.meanPos = {
        "x": (touch.bbox.x + touch.bbox.u) / 2,
        "y": (touch.bbox.y + touch.bbox.v) / 2
    };
    offset = {
        "x": -Math.floor(initOffset.x + (touch.meanPos.x - initTouch.meanPos.x) / zoom), 
        "y": -Math.floor(initOffset.y + (touch.meanPos.y - initTouch.meanPos.y) / zoom)
    }
    if (e.touches.length > 1) {
        let rawZoom = Math.max(
            Math.abs(touch.bbox.u - touch.bbox.x) / Math.abs(initTouch.bbox.u - initTouch.bbox.x),
            Math.abs(touch.bbox.v - touch.bbox.y) / Math.abs(initTouch.bbox.v - initTouch.bbox.y)
        );
        zoom = Math.floor(initZoom * rawZoom);
        zoom = Math.min(Math.max(zoom, 1), 1 << 4);
    }
});

const canvas = document.getElementById("output");

// Expose a few variables for debugging and/or anyone who wants to mess around in the devtools

let imageSize;
let pan;
let font;
let done;
let io;
let oldKeysDown = new Array(512);
oldKeysDown.fill(false);
Object.seal(oldKeysDown);
let keysJustDown = new Array(512);
keysJustDown.fill(false);
Object.seal(keysJustDown);
let popups;
let menuOffset;
let screenSize;
let mousePos;
let lastFrameDeltas = new Array(300);
lastFrameDeltas.fill(17);
let trackpadMode = window.localStorage.getItem("trackpadMode");
if (trackpadMode == null) {
    trackpadMode = false;
} else {
    trackpadMode = trackpadMode === "true";
};

(async function() {
    await ImGui.default();
    ImGui.CreateContext();
    ImGui_Impl.Init(canvas);
    const gl = ImGui_Impl.gl;
    done = false;
    // Loop variables
    let files = null;
    let texture = gl.createTexture();
    texture.image = new Image();
    imageSize = {
        "w": null,
        "h": null
    }
    pan = {"origin": null, "offset": {"x": 0, "y": 0}}
    io = ImGui.GetIO();
    font = null;

    function loadFiles(files) {
        Array.from(files).forEach(file => {
            let reader = new FileReader();
            if (file.name.slice(-3) == "pil") {
                reader.onload = () => {
                    font = loadFont(reader.result);
                }
                reader.readAsArrayBuffer(file);
            } else {
                texture.image = new Image();
                reader.onload = () => {
                    let mime = file.mime;
                    if (file.name.slice(-3) == "pbm") {
                        mime = "image/png";
                    }
                    texture.image.src = "data:" + mime + ";base64," + btoa(reader.result);
                    texture.image.onload = () => {
                        imageSize.w = texture.image.naturalWidth;
                        imageSize.h = texture.image.naturalHeight;
                        gl.bindTexture(gl.TEXTURE_2D, texture);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                        gl.texImage2D(
                            gl.TEXTURE_2D,
                            0,
                            gl.RGBA,
                            gl.RGBA,
                            gl.UNSIGNED_BYTE,
                            texture.image
                        );
                    }
                }
                reader.readAsBinaryString(file);
            }
        });
    }

    let frameTime = performance.now();
    
    window.requestAnimationFrame(_loop);
    const frameDelta = Math.floor(1000 / 60); // Max out at 60 fps for high refresh rate displays

    function _loop(time) {
        lastFrameDeltas.push(performance.now() - frameTime);
        lastFrameDeltas = lastFrameDeltas.splice(1);
        frameTime = performance.now();
        ImGui_Impl.NewFrame(time);
        ImGui.NewFrame();
        for (let i = 0; i < io.KeysDown.length; i++) {
            keysJustDown[i] = io.KeysDown[i] & !oldKeysDown[i];
        }
        popups = [];
        menuOffset = 0;
        screenSize = {w: io.DisplaySize.x, h: io.DisplaySize.y};
        mousePos = ImGui.GetMousePos();

        // --- Drawing the UI ---
        if (ImGui.BeginMainMenuBar()) {
            menuOffset = ImGui.GetWindowSize().y;
            screenSize.y -= menuOffset;
            if (ImGui.BeginMenu("File", true)) {
                if (ImGui.MenuItem("Open", null, false, true)) {
                    openFiles().then(loadFiles);
                }
                ImGui.EndMenu();
            }
            if (ImGui.BeginMenu("Controls", true)) {
                ImGui.Text(`- Right click to pan while using mouse`);
                ImGui.Text(`- Pinch to zoom, one finger to pan while using touchscreen`);
                ImGui.Text(`- Pinch to zoom, two fingers to pan while using trackpad`);
                ImGui.Text(`  - If using trackpad, enable`);
                ImGui.SameLine();
                ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(0, 0));
                changedMode = ImGui.Checkbox("##trackpad", (_ = trackpadMode) => trackpadMode = _);
                if (changedMode) window.localStorage.setItem("trackpadMode", trackpadMode);
                ImGui.PopStyleVar();
                ImGui.EndMenu();
            }
            ImGui.EndMainMenuBar();
        }
        ImGui.SetNextWindowSize(
            new ImGui.Vec2(screenSize.w, screenSize.h)
        );
        ImGui.SetNextWindowPos(
            new ImGui.Vec2(0, menuOffset)
        );
        ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(0, 0));
        if (ImGui.Begin(
            "Image",
            null,
            (
                ImGui.WindowFlags.NoResize |
                ImGui.WindowFlags.NoMove |
                ImGui.WindowFlags.NoSavedSettings |
                ImGui.WindowFlags.NoDecoration |
                ImGui.WindowFlags.NoScrollWithMouse |
                ImGui.WindowFlags.NoNavFocus |
                ImGui.WindowFlags.NoBringToFrontOnFocus |
                ImGui.WindowFlags.NoFocusOnAppearing |
                ImGui.WindowFlags.NoBackground
            )
        )) {
            let mouseX = mousePos.x;
            let mouseY = mousePos.y;
            mouseY -= menuOffset;
            let drawList = ImGui.GetWindowDrawList();
            let didZoom = Math.abs(io.MouseWheel) > 0 & (!trackpadMode);
            if (ImGui.IsWindowHovered()) {
                if (io.MouseDown[1]) {
                    if (pan.origin == null) {
                        pan.origin = {"x": mouseX, "y": mouseY};
                        pan.offset = {"x": offset.x, "y": offset.y}; // Clone offset
                    }
                } else {
                    if (pan.origin != null) {
                        pan.origin = null;
                        pan.offset = {"x": 0, "y": 0};
                    }
                }
                let strength = 2 ** Math.sign(io.MouseWheel);
                didZoom &= 1 <= zoom * strength & zoom * strength <= 16;
                zoom = Math.min(Math.max(zoom, 1), 1 << 4);
                if (didZoom) {
                    let oldZoom = zoom;
                    zoom *= strength;
                    if (1 <= zoom & zoom <= 16) {
                        offset = {
                            "x": (offset.x + ((mouseX - screenSize.w / 2) / Math.max(zoom, oldZoom)) * Math.sign(zoom - oldZoom)), 
                            "y": (offset.y + ((mouseY - screenSize.h / 2) / Math.max(zoom, oldZoom)) * Math.sign(zoom - oldZoom))
                        };
                        pan.offset = {"x": offset.x, "y": offset.y};
                    }
                    zoom = Math.min(Math.max(zoom, 1), 1 << 4);
                } else if (trackpadMode) {
                    offset.x -= mouseWheel.x;
                    offset.y -= mouseWheel.y;
                }
                if (pan.origin != null) {
                    if (didZoom) {
                        pan.origin = {"x": mouseX, "y": mouseY};
                        pan.offset = {"x": offset.x, "y": offset.y};
                    } else {
                        offset.x = (pan.origin.x - mouseX) / zoom + pan.offset.x;
                        offset.y = (pan.origin.y - mouseY) / zoom + pan.offset.y;
                    }
                }
            }
            let fixedOffset = {
                "x": Math.floor(-offset.x * zoom + (screenSize.w / 2)),
                "y": Math.floor(-offset.y * zoom + (screenSize.h / 2)) + menuOffset
            };
            if (imageSize.w != null & imageSize.h != null) {
                drawList.AddImage(
                    texture,
                    new ImGui.Vec2(Math.floor(fixedOffset.x), Math.floor(fixedOffset.y)),
                    new ImGui.Vec2(Math.floor(fixedOffset.x + imageSize.w * zoom), Math.floor(fixedOffset.y + imageSize.h * zoom))
                );
            }
            let lines = Array.of(
                `${Math.floor(1000 / (lastFrameDeltas.reduce((a, b) => a + b) / lastFrameDeltas.length))} FPS`,
                `${Math.floor(offset.x)} ${Math.floor(offset.y)} ${zoom}x`
            );
            let textWidth = 0;
            let textHeight = 0;
            for (let line of lines) {
                textWidth = Math.max(textWidth, 7 * line.length + 1);
                textHeight += ImGui.GetTextLineHeight();
            }
            drawList.AddRect(
                new ImGui.Vec2(0, menuOffset),
                new ImGui.Vec2(textWidth, menuOffset + textHeight),
                ImGui.GetColorU32(ImGui.Col.Border),
                0.0,
                0,
                3.0
            );
            drawList.AddRectFilled(
                new ImGui.Vec2(0, menuOffset),
                new ImGui.Vec2(textWidth, menuOffset + textHeight),
                ImGui.GetColorU32(ImGui.Col.PopupBg)
            );
            ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(0, 0));
            for (let line of lines) {
                ImGui.TextDisabled(line);
            }
            ImGui.PopStyleVar();
            if (font != null) {
                // The length HAS to be 256. There's no way without tampering to have it not be here.
                for (let i = 0; i < 256; i++) {
                    let glyph = font.glyphs[i];
                    if (glyph != null) {
                        let glyphBBox = {};
                        glyphBBox.x = Math.floor(glyph.srcBBox.x * zoom + fixedOffset.x);
                        glyphBBox.y = Math.floor(glyph.srcBBox.y * zoom + fixedOffset.y);
                        glyphBBox.u = Math.floor(glyph.srcBBox.u * zoom + fixedOffset.x);
                        glyphBBox.v = Math.floor(glyph.srcBBox.v * zoom + fixedOffset.y);
                        let borderColor = ImGui.GetColorU32(new ImGui.Vec4(1., 1., 1., Math.min(0.5, zoom / 8)));
                        let fillColor   = ImGui.GetColorU32(new ImGui.Vec4(1., 1., 1., Math.min(0.125, zoom / 32)));
                        if (
                            ImGui.IsWindowHovered() &
                            glyphBBox.x <= mousePos.x & mousePos.x < glyphBBox.u &
                            glyphBBox.y <= mousePos.y & mousePos.y < glyphBBox.v
                        ) {
                            doDraw = true;
                            borderColor = ImGui.GetColorU32(ImGui.Col.ButtonHovered, 0.7);
                            fillColor = ImGui.GetColorU32(ImGui.Col.ButtonHovered, 0.3);
                            ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(2, 2));
                            ImGui.BeginTooltip();
                            let charNumber = glyph.character.charCodeAt(0);
                            let drawnChar = charNumber >= 32 ? glyph.character : "?";
                            ImGui.Text(`Glyph: ${drawnChar} (U+${charNumber.toString(16).padStart(2, "0").toUpperCase()})`);
                            ImGui.Text(`Source UV: (${glyph.srcBBox.x}, ${glyph.srcBBox.y}), (${glyph.srcBBox.u}, ${glyph.srcBBox.v})`);
                            ImGui.Text(`Destination UV: (${glyph.dstBBox.x}, ${glyph.dstBBox.y}), (${glyph.dstBBox.u}, ${glyph.dstBBox.v})`);
                            ImGui.Text(`Delta: ${glyph.delta.x}, ${glyph.delta.y}`);
                            ImGui.Image(
                                texture,
                                new ImGui.Vec2((glyph.srcBBox.u - glyph.srcBBox.x) * zoom, (glyph.srcBBox.v - glyph.srcBBox.y) * zoom),
                                new ImGui.Vec2(glyph.srcBBox.x / imageSize.w, glyph.srcBBox.y / imageSize.h),
                                new ImGui.Vec2(glyph.srcBBox.u / imageSize.w, glyph.srcBBox.v / imageSize.h)
                            );
                            ImGui.EndTooltip();
                            ImGui.PopStyleVar();
                        }
                        if ((glyphBBox.x != glyphBBox.u) & (glyphBBox.y != glyphBBox.v)) {
                            drawList.AddRectFilled(
                                new ImGui.Vec2(glyphBBox.x, glyphBBox.y),
                                new ImGui.Vec2(glyphBBox.u, glyphBBox.v),
                                fillColor
                            );
                            drawList.AddRect(
                                new ImGui.Vec2(glyphBBox.x, glyphBBox.y),
                                new ImGui.Vec2(glyphBBox.u, glyphBBox.v),
                                borderColor
                            );
                        }
                    }
                }
            }
            ImGui.End();
        }
        ImGui.PopStyleVar();


        // --- Rendering ---

        ImGui.EndFrame();
        ImGui.Render();
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(.1, .1, .1, 1.);
        
        gl.clear(gl.COLOR_BUFFER_BIT);
        ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
        
        for (let i = 0; i < oldKeysDown.length; i++) {
            oldKeysDown[i] = io.KeysDown[i];
        }
        
        if (performance.now() - frameTime >= frameDelta) {
            window.requestAnimationFrame(done ? _done : _loop);
        } else {
            setTimeout(()=>{
                window.requestAnimationFrame(done ? _done : _loop);
            }, Math.max(frameDelta - lastFrameDeltas[0], 0));
        }
    }

    function _done() {
        ImGui_Impl.Shutdown();
        ImGui.DestroyContext();
    }
})();