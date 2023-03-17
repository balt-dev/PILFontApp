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

const canvas = document.getElementById("output");

// Expose a few variables for debugging and/or anyone who wants to mess around in the devtools

let zoom;
let imageSize;
let offset;
let pan;
let font;
let done;

(async function() {
    await ImGui.default();
    ImGui.CreateContext();
    ImGui_Impl.Init(canvas);
    const gl = ImGui_Impl.gl;
    done = false;
    // Loop variables
    let files = null;
    let texture = gl.createTexture();
    imageSize = {
        "w": null,
        "h": null
    }
    offset = {
        "x": 0,
        "y": 0
    };
    zoom = 1.0;
    pan = {"origin": null, "offset": {"x": 0, "y": 0}}
    let io = ImGui.GetIO();
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
    window.requestAnimationFrame(_loop);

    function _loop(time) {
        ImGui_Impl.NewFrame(time);
        ImGui.NewFrame();
        let popups = [];
        let menuOffset = 0;
        let screenSize = {w: io.DisplaySize.x, h: io.DisplaySize.y};
        let mousePos = ImGui.GetMousePos();

        // --- Drawing the UI ---
        if (ImGui.BeginMainMenuBar()) {
            menuOffset = ImGui.GetWindowSize().y;
            if (ImGui.BeginMenu("File", true)) {
                if (ImGui.MenuItem("Open", null, false, true)) {
                    openFiles().then(loadFiles);
                }
                ImGui.EndMenu();
            }
            ImGui.EndMainMenuBar();
        }
        ImGui.SetNextWindowSize(
            new ImGui.Vec2(screenSize.w, screenSize.h - menuOffset)
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
            if (imageSize.w != null & imageSize.h != null) {
                drawList.AddImage(
                    texture,
                    new ImGui.Vec2(Math.floor(offset.x), Math.floor(offset.y + menuOffset)),
                    new ImGui.Vec2(Math.floor(offset.x + imageSize.w * zoom), Math.floor(offset.y + imageSize.h * zoom + menuOffset))
                );
            }
            if (ImGui.IsWindowHovered()) {
                if (Math.abs(io.MouseWheel) > 0) {
                    let targetPoint = {"x": (mouseX - offset.x) / zoom, "y": (mouseY - offset.y) / zoom}
                    let strength = Math.sign(io.MouseWheel);
                    if (zoom <= 1) {
                        strength = Math.max(0, strength);
                    } else if (zoom >= 1 << 4) {
                        strength = Math.min(0, strength);
                    }
                    zoom = 2 ** (Math.log2(zoom) + strength);
                    offset.x = -targetPoint.x * zoom + mouseX
                    offset.y = -targetPoint.y * zoom + mouseY
                    if (pan.origin != null) { // If currently panning
                        pan.offset = {"x": offset.x, "y": offset.y}; // Update offset
                    }
                }
                if (io.MouseDown[1]) {
                    if (pan.origin == null) { // Just started panning
                        pan.origin = {"x": mouseX, "y": mouseY};
                        pan.offset = {"x": offset.x, "y": offset.y}; // Clone offset
                    }
                    offset.x = mouseX - pan.origin.x + pan.offset.x;
                    offset.y = mouseY - pan.origin.y + pan.offset.y;
                } else if (pan.origin != null) { // Stopped panning
                    pan.origin = null;
                    pan.offset = {"x": 0, "y": 0};
                }
                zoom = Math.min(Math.max(zoom, 1), 1 << 4);
            }
            if (font != null) {
                // The length HAS to be 256. There's no way without tampering to have it not be here.
                for (let i = 0; i < 256; i++) {
                    let glyph = font.glyphs[i];
                    if (glyph != null) {
                        let glyphBBox = {};
                        glyphBBox.x = Math.floor(glyph.srcBBox.x * zoom + offset.x);
                        glyphBBox.y = Math.floor(glyph.srcBBox.y * zoom + offset.y + menuOffset);
                        glyphBBox.u = Math.floor(glyph.srcBBox.u * zoom + offset.x);
                        glyphBBox.v = Math.floor(glyph.srcBBox.v * zoom + offset.y + menuOffset);
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
        window.requestAnimationFrame(done ? _done : _loop);
    }

    function _done() {
        ImGui_Impl.Shutdown();
        ImGui.DestroyContext();
    }
})();