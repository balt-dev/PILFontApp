const fileInput = document.getElementById("file");
const imageInput = document.getElementById("imageonly");
const a = document.getElementById("clickable")
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let currentAlert;

function openFiles(input, allowMultiple = true) {
    input.multiple = allowMultiple;
    return new Promise((resolve, reject) => {
        input.onchange = _ => {
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

class Point {
    constructor(x = 0, y = 0) {
        if (typeof(x) == "object") {
            this.x = x.x;
            this.y = x.y;
        } else {
            this.x = x;
            this.y = y;
        }
    }

    copy() {
        return new Point(this.x, this.y);
    }

    distance(other) {
        return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
    }

    ImVec2() {
        return new ImGui.Vec2(this.x, this.y);
    }
}

Point.prototype.toString = function() {
    return `{"x": ${this.x}, "y": ${this.y}}`;
}

class Box {
    constructor(x = 0, y = 0, u = null, v = null) {
        // 2-point constructor
        if (
            typeof(x) == "object" & 
            typeof(y) == "object" &
            u == null &
            v == null
        ) {
            this.xy = x;
            this.uv = u;
        } else { // 4-number constructor
            this.x = x;
            this.y = y;
            this.u = u != null ? u : 0;
            this.v = v != null ? v : 0;
        }
    }

    copy() {
        return new Box(this.x, this.y, this.u, this.v);
    }

    get xy() {
        return new Point(this.x, this.y);
    }

    get z() {return this.u;}
    get w() {return this.v;}

    set z(val) {this.u = val;}
    set w(val) {this.v = val;}

    get uv() {
        return new Point(this.u, this.v);
    }

    set xy(pt) {
        this.x = pt.x;
        this.y = pt.y;
    }

    set uv(pt) {
        this.u = pt.x;
        this.v = pt.y;
    }

    get width() {
        return this.u - this.x;
    }

    get height() {
        return this.v - this.y;
    }

    set width(wid) {
        this.u = this.x + wid;
    }

    set height(hgt) {
        this.v = this.y + hgt;
    }

    get midpoint() {
        return new Point((this.u + this.x) / 2, (this.v + this.y) / 2);
    }

    get area() {
        return this.width * this.height;
    }

    get diagonal() {
        return this.xy.distance(this.uv);
    }

    contains(pt) {
        return (
            this.x <= pt.x & pt.x < this.u &
            this.y <= pt.y & pt.y < this.v
        )
    }

    ImVec4() {
        return new ImGui.Vec4(this.x, this.y, this.u, this.v);
    }
}

Box.prototype.toString = function() {
    return `{"x": ${this.x}, "y": ${this.y}, "u": ${this.u}, "v": ${this.v}}`;
}

class Glyph {
    constructor(character = null, delta = new Point(), src = new Box(), dst = new Point()) {
        this.character = character;
        this.delta = delta;
        this.src = src;
        this.dst = dst;
    }

    copy() {
        return new Glyph(
            this.character,
            this.delta.copy(),
            this.src.copy(),
            this.dst.copy()
        );
    }
}

Glyph.prototype.toString = function() {
    return `{"character": ${this.character}, "delta": ${this.delta}, "src": ${this.src}, "dst": ${this.dst}}`;
}

class Font {
    constructor(ysize = 0, glyphs = new Array(256)) {
        this.ysize = ysize;
        this.glyphs = glyphs.slice(); // Clone array
        for (let i = 0; i < 256; i++) {
            this.glyphs[i] = new Glyph(String.fromCharCode(i));
        }
        Object.seal(this.glyphs);
    }
}

Font.prototype.toString = function() {
    // JSON.stringify throws because of cyclic and I'm too lazy to grab cycle.js
    return `{"ysize": ${this.ysize}, "glyphs": ${this.glyphs}}`;
}

function loadFont(buf) {
    // Load font to object
    let index = 0;

    function pop(len) {
        return buf.slice(index, index += len);
    }

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
    font = new Font(parseInt(decoder.decode(num_arr), 10));
    if (!check(pop(7), ";\nDATA\n")) {
        alert("Error while parsing font: Incorrect header");
        return null;
    }
    buf = buf.slice(index);
    index = 0;
    let view = new DataView(buf);
    for (let i = 0; i < 256; i++) {
        let dx = view.getInt16(0 + i * 20);
        let dy = view.getInt16(2 + i * 20);
        let dx0 = view.getInt16(4 + i * 20);
        let dy0 = view.getInt16(6 + i * 20);
        /*
        let dx1 = view.getInt16(8 + i * 20);
        let dy1 = view.getInt16(10 + i * 20);
        These serve literally no purpose, 
        and without them it could've been 16 bytes per glyph, 
        but nope :P 
        */ 
        let sx0 = view.getInt16(12 + i * 20);
        let sy0 = view.getInt16(14 + i * 20);
        let sx1 = view.getInt16(16 + i * 20);
        let sy1 = view.getInt16(18 + i * 20);
        font.glyphs[i] = new Glyph(
            String.fromCharCode(i),
            new Point(dx, dy),
            new Box(sx0, sy0, sx1, sy1),
            new Point(dx0, dy0)
        );
    }
    return font;
}

function saveFont(font) {
    let prefix = `PILfont
;;;;;;${font.ysize};
DATA
`
    let buf = new ArrayBuffer(prefix.length + 2 * 10 * 256) // 10 numbers per glyph with 2 bytes per number and 256 glyphs
    let view = new DataView(buf)
    for (let i = 0; i < prefix.length; i++) {
        view.setUint8(i, prefix.charCodeAt(i));
    }
    let seek = prefix.length;
    
    for (let i = 0; i < 256; i++) {
        let glyph = font.glyphs[i];
        view.setInt16(20*i + 0 + seek, glyph.delta.x);
        view.setInt16(20*i + 2 + seek, glyph.delta.y);
        view.setInt16(20*i + 4 + seek, glyph.dst.x);
        view.setInt16(20*i + 6 + seek, glyph.dst.y);
        view.setInt16(20*i + 8 + seek, glyph.dst.x + glyph.src.width);
        view.setInt16(20*i + 10 + seek, glyph.dst.y + glyph.src.height);
        view.setInt16(20*i + 12 + seek, glyph.src.x);
        view.setInt16(20*i + 14 + seek, glyph.src.y);
        view.setInt16(20*i + 16 + seek, glyph.src.u);
        view.setInt16(20*i + 18 + seek, glyph.src.v);
    }
    let blob = new Blob([buf], {'type': 'application/octet-stream'});
    let url = URL.createObjectURL(blob);
    a.href = url;
    a.download = 'font.pil';
    a.click();
    URL.revokeObjectURL(url);
}

let offset = new Point();
let zoom = 1.0;

// For if the user is using a trackpad

const mouseWheel = new Point();

let wheelTimeout;
let initialZoom = zoom;
window.addEventListener("wheel", (event) => {
    clearTimeout(wheelTimeout);
    if (event.ctrlKey) {
        initialZoom -= event.deltaY / 10;
        zoom = Math.min(64, Math.max(1, Math.floor(initialZoom)));
    } else {
        mouseWheel.x = -event.deltaX / zoom;
        mouseWheel.y = -event.deltaY / zoom;
    }
    wheelTimeout = setTimeout(() => {
        mouseWheel.x = 0; mouseWheel.y = 0; initialZoom = zoom;
    }, 20);
}, false);

// For if the user has a touchscreen

let initOffset;
let initZoom;
let initTouch = new Box();
let touch = new Box();


window.addEventListener("touchstart", function (e) {
    e.preventDefault();
    initOffset = new Point(-offset.x, -offset.y);
    initZoom = zoom;
    initTouch = new Box(Infinity, Infinity, -Infinity, -Infinity);
    for (let i = 0; i < e.touches.length; i++) {
        let t = e.touches[i];
        initTouch.x = Math.min(initTouch.x, t.clientX);
        initTouch.y = Math.min(initTouch.y, t.clientY);
        initTouch.u = Math.max(initTouch.u, t.clientX);
        initTouch.v = Math.max(initTouch.v, t.clientY);
    }
});

window.addEventListener("touchmove", function (e) {
    e.preventDefault();
    touch = new Box(Infinity, Infinity, -Infinity, -Infinity);
    for (let t of Array.from(e.touches)) {
        touch.x = Math.min(touch.x, t.clientX);
        touch.y = Math.min(touch.y, t.clientY);
        touch.u = Math.max(touch.u, t.clientX);
        touch.v = Math.max(touch.v, t.clientY);
    }
    offset = new Point(
        -Math.floor(initOffset.x + (touch.x - initTouch.x) / zoom),
        -Math.floor(initOffset.y + (touch.y - initTouch.y) / zoom)
    );
    if (e.touches.length > 1) {
        let rawZoom = touch.diagonal / initTouch.diagonal;
        zoom = Math.min(Math.max(initZoom * rawZoom, 1), 64);
    }
});

function checkEnd(e) {
    if (e.touches.length == 0) {
        zoom = Math.floor(zoom);
    }
}

window.addEventListener("touchend", checkEnd);
window.addEventListener("touchcancel", checkEnd);

const canvas = document.getElementById("output");

// Declare variables

let imageSize;
let pan;
let font = new Font();
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
let testingString = `Everyone has the right to a standard of living
adequate for the health and well-being of themself and of their family,
including food, clothing, housing and medical care 
and necessary social services, and the right to security
in the event of unemployment, sickness, disability,
widowhood, old age or other lack of livelihood
in circumstances beyond their control.`;
let previewOpen = false;
let generatorOpen = false;
let editOriginal = new Glyph(null);
let editPosition = new Point();
let editingSide = null;
let wasEditing = false;
let addGlyphOpen = false;
let addedCharacter = 0x41;
let genParams = {
    "columns": 16,
    "ySize": 12,
    "dst": new Point(0, 0),
    "delta": new Point(0, 0),
    "src": new Point(0, 0),
    "ignoreControl": true
}

const Side = {
    LEFT: Symbol("Left"),
    TOP: Symbol("Top"),
    RIGHT: Symbol("Right"),
    BOTTOM: Symbol("Bottom")
}

// The actual editor!

function textCentered(line, textOffset = 0) {
    let fontSize = ImGui.CalcTextSize(line);
    let windowSize = ImGui.GetWindowSize();
    let offset = (windowSize.x - fontSize.x) / 2 - 8 + textOffset;
    ImGui.Dummy(new ImGui.Vec2(offset, fontSize.y));
    ImGui.SameLine(0.0, 0.0);
    ImGui.Text(line);
}

(async function () {
    await ImGui.default();
    ImGui.CreateContext();
    ImGui_Impl.Init(canvas);
    const gl = ImGui_Impl.gl;
    done = false;
    // Loop variables
    let texture = gl.createTexture();
    texture.image = new Image();
    imageSize = {
        "w": null,
        "h": null
    }
    pan = { "origin": null, "offset": new Point() }
    io = ImGui.GetIO();

    function initFont() {
        font = new Font();
        gl.deleteTexture(texture);
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.bindTexture(gl.TEXTURE_2D, null);
        imageSize.w = null;
        imageSize.h = null;
        generatorOpen = true;
    }

    function loadImage(file) {
        let reader = new FileReader();
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
                gl.bindTexture(gl.TEXTURE_2D, null);
            }
        }
        reader.readAsBinaryString(file);
    }
    
    function loadFiles(files) {
        Array.from(files).forEach(file => {
            let reader = new FileReader();
            if (file.name.slice(-3) == "pil") {
                reader.onload = () => {
                    font = loadFont(reader.result);
                }
                reader.readAsArrayBuffer(file);
            } else {
                loadImage(file);
            }
        });
    }

    let frameTime = performance.now();

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
        screenSize = { w: io.DisplaySize.x, h: io.DisplaySize.y };
        mousePos = ImGui.GetMousePos();
        mousePos = new Point(mousePos.x, mousePos.y);

        // --- Drawing the UI ---
        if (ImGui.BeginMainMenuBar()) {
            menuOffset = ImGui.GetWindowSize().y;
            screenSize.y -= menuOffset;
            if (ImGui.BeginMenu("File", true)) {
                if (ImGui.MenuItem("New", null, false, true)) {
                    if (font != null) {
                        popups.push("##newAlert");
                    } else {
                        initFont();
                    }
                }
                if (ImGui.MenuItem("Open", null, false, true)) {
                    if (window.localStorage.getItem("doNotShowOpen")) {
                        openFiles(fileInput).then(loadFiles, (reason) => {
                            currentAlert = `${reason}`;
                            popups.push("##openDynamicAlert");
                        });
                    } else {
                        popups.push("##openAlert");
                    };
                }
                if (ImGui.MenuItem("Save", null, false, font != null)) {
                    saveFont(font);
                }
                ImGui.EndMenu();
            }
            if (ImGui.BeginMenu("Edit", font != null)) {
                ImGui.PushItemWidth(100);
                // I probably should limit the ysize but nah, if people wanna make weird things that's on them
                ImGui.InputInt("Line Height", (_ = font.ysize) => font.ysize = _);
                ImGui.PopItemWidth();
                previewOpen |= ImGui.Button("Open Preview");
                generatorOpen |= ImGui.Button("Generate Mappings");
                ImGui.EndMenu();
            }
            if (ImGui.BeginMenu("Help", true)) {
                ImGui.Text(`- Right click to pan, scroll to zoom`);
                ImGui.Text(`  - Pinch to zoom, one finger to pan while using touchscreen`);
                ImGui.Text(`  - Pinch to zoom, two fingers to pan while using trackpad`);
                ImGui.Text(`    - If using trackpad, enable`);
                ImGui.SameLine();
                ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, ImGui.Vec2.ZERO);
                changedMode = ImGui.Checkbox("##trackpad", (_ = trackpadMode) => trackpadMode = _);
                if (changedMode) window.localStorage.setItem("trackpadMode", trackpadMode);
                ImGui.PopStyleVar();
                ImGui.Text(`- Drag glyph bounding box to move`);
                ImGui.Text(`  - Drag sides of glyph bounding box to resize`);
                ImGui.Text(`  - Hold shift to move baseline offset`);
                ImGui.Text(`  - Hold control to move delta position (i.e. where the next glyph is placed)`);
                ImGui.Text(`  - Hold both shift and control and click to open a GUI editor`);
                ImGui.EndMenu();
            }
            if (ImGui.BeginMenu("About", true)) {
                ImGui.PushTextWrapPos(300);
                ImGui.TextWrapped(`This is a visual editor for a bitmap font format created by the Python Imaging Library team back in 1996.`);
                if (ImGui.Button(`GitHub Page`)) {window.open("https://github.com/balt-dev/PILFontApp", "_blank")};
                ImGui.PopTextWrapPos();
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
        // Atlas drawing
        ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, ImGui.Vec2.ZERO);
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
            let mousePosDraw = mousePos.copy();
            mousePosDraw.y -= menuOffset;
            let drawList = ImGui.GetWindowDrawList();
            let didZoom = Math.abs(io.MouseWheel) > 0 & (!trackpadMode);
            if (ImGui.IsWindowHovered()) {
                if (io.MouseDown[1]) {
                    if (pan.origin == null) {
                        pan.origin = mousePosDraw.copy();
                        pan.offset = offset.copy(); // Clone offset
                    }
                } else {
                    if (pan.origin != null) {
                        pan.origin = null;
                        pan.offset = new Point();
                    }
                }
                let strength = 2 ** Math.sign(io.MouseWheel);
                didZoom &= 1 <= zoom * strength & zoom * strength <= 64;
                zoom = Math.min(Math.max(zoom, 1), 64);
                if (didZoom) {
                    let oldZoom = zoom;
                    zoom *= strength;
                    if (1 <= zoom & zoom <= 64) {
                        offset = new Point(
                            (offset.x + ((mousePosDraw.x - screenSize.w / 2) / Math.max(zoom, oldZoom)) * Math.sign(zoom - oldZoom)),
                            (offset.y + ((mousePosDraw.y - screenSize.h / 2) / Math.max(zoom, oldZoom)) * Math.sign(zoom - oldZoom))
                        );
                        pan.offset = offset.copy();
                    }
                    zoom = Math.min(Math.max(zoom, 1), 64);
                } else if (trackpadMode) {
                    offset.x -= mouseWheel.x;
                    offset.y -= mouseWheel.y;
                }
                if (pan.origin != null) {
                    if (didZoom) {
                        pan.origin = mousePosDraw.copy();
                        pan.offset = offset.copy();
                    } else {
                        offset.x = (pan.origin.x - mousePosDraw.x) / zoom + pan.offset.x;
                        offset.y = (pan.origin.y - mousePosDraw.y) / zoom + pan.offset.y;
                    }
                }
            }
            let fixedOffset = new Point(
                Math.floor(-offset.x * zoom + (screenSize.w / 2)),
                Math.floor(-offset.y * zoom + (screenSize.h / 2)) + menuOffset
            );
            if (imageSize.w != null & imageSize.h != null) {
                drawList.AddImage(
                    texture,
                    new ImGui.Vec2(Math.floor(fixedOffset.x), Math.floor(fixedOffset.y)),
                    new ImGui.Vec2(Math.floor(fixedOffset.x + imageSize.w * zoom), Math.floor(fixedOffset.y + imageSize.h * zoom))
                );
            }

            // FPS and offset display
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
            ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, ImGui.Vec2.ZERO);
            for (let line of lines) {
                ImGui.TextDisabled(line);
            }
            ImGui.PopStyleVar();


            // Editing
            let stopEditing = true;
            if (font != null) {
                let metricsToDraw = [];
                // The length HAS to be 256. There's no way without tampering to have it not be here.
                for (let i = 0; i < 256; i++) {
                    let glyph = font.glyphs[i];
                    if (glyph != null) {
                        glyph.drawingBBox = new Box(
                            Math.floor(glyph.src.x * zoom + fixedOffset.x),
                            Math.floor(glyph.src.y * zoom + fixedOffset.y),
                            Math.floor(Math.max(glyph.src.u, glyph.src.x+1) * zoom + fixedOffset.x),
                            Math.floor(Math.max(glyph.src.v, glyph.src.y+1) * zoom + fixedOffset.y)
                        );
                        let drawMetrics = ImGui.IsWindowHovered() & glyph.drawingBBox.contains(mousePos);
                        if ((drawMetrics & !wasEditing) | glyph.character == editOriginal.character) {                            
                            // Editing
                            if (io.MouseDown[0]) {
                                stopEditing = false;
                                if (!wasEditing) {
                                    editOriginal = glyph.copy();
                                    editPosition = mousePos.copy();
                                    wasEditing = true;
                                    if ((mousePos.x - glyph.drawingBBox.x) < glyph.drawingBBox.width / 4) {
                                        editingSide = Side.LEFT;
                                    } else if ((mousePos.y - glyph.drawingBBox.y) < glyph.drawingBBox.height / 4) {
                                        editingSide = Side.TOP;
                                    } else if ((glyph.drawingBBox.u - mousePos.x) < glyph.drawingBBox.width / 4) {
                                        editingSide = Side.RIGHT;
                                    } else if ((glyph.drawingBBox.v - mousePos.y) < glyph.drawingBBox.height / 4) {
                                        editingSide = Side.BOTTOM;
                                    } else {
                                        editingSide = null;
                                    }
                                }
                            } else {
                                stopEditing = true;
                            }
                            metricsToDraw.push(glyph);
                        } else if (glyph.drawingBBox.area > 0) {
                            let outsideColor = (glyph.src.u > glyph.src.x | glyph.src.v > glyph.src.y) ?
                                               ImGui.GetColorU32(new ImGui.Vec4(1., 1., 1., Math.min(16, zoom) * (0.125 / 16))) :
                                               ImGui.GetColorU32(new ImGui.Vec4(.7, .5, 1., Math.min(16, zoom) * (0.125 / 16)));
                            let insideColor = (glyph.src.u > glyph.src.x | glyph.src.v > glyph.src.y) ?
                                               ImGui.GetColorU32(new ImGui.Vec4(1., 1., 1., Math.min(16, zoom) * (0.5 / 16))) :
                                               ImGui.GetColorU32(new ImGui.Vec4(.7, .5, 1., Math.min(16, zoom) * (0.5 / 16)));                            
                            drawList.AddRectFilled(
                                new ImGui.Vec2(glyph.drawingBBox.x, glyph.drawingBBox.y),
                                new ImGui.Vec2(glyph.drawingBBox.u, glyph.drawingBBox.v),
                                outsideColor
                            );
                            drawList.AddRect(
                                new ImGui.Vec2(glyph.drawingBBox.x, glyph.drawingBBox.y),
                                new ImGui.Vec2(glyph.drawingBBox.u, glyph.drawingBBox.v),
                                insideColor
                            );
                            let char = glyph.character;
                            let index = char.charCodeAt(0);
                            char = index < 0x20 ? "?" : char; 
                            if (glyph.drawingBBox.width >= 16 & glyph.drawingBBox.height >= 16) {
                                drawList.AddText(
                                    new ImGui.Vec2(glyph.drawingBBox.x, glyph.drawingBBox.y),
                                    ImGui.GetColorU32(1., 1., 1., 1.),
                                    `${char} (U+${index.toString(16).padStart(2, "0").toUpperCase()})`
                                )
                            }
                        }
                        if (io.MouseDown[0] & wasEditing & glyph.character == editOriginal.character) {
                            stopEditing = false;
                            let mouseOffset = new Point(
                                Math.floor((editPosition.x - mousePos.x) / zoom),
                                Math.floor((editPosition.y - mousePos.y) / zoom)
                            );
                            if (io.KeyCtrl & !io.KeyShift) {
                                glyph.delta = new Point(
                                    editOriginal.delta.x - mouseOffset.x,
                                    editOriginal.delta.y - mouseOffset.y
                                );
                            } else if (io.KeyShift & !io.KeyCtrl) {
                                glyph.dst = new Point(
                                    editOriginal.dst.x + mouseOffset.x,
                                    editOriginal.dst.y + mouseOffset.y
                                );
                            } else if (io.KeyCtrl & io.KeyShift) {
                                addedCharacter = glyph.character.charCodeAt(0);
                            } else {
                                switch (editingSide) {
                                    case Side.LEFT:
                                        glyph.src.x = editOriginal.src.x - mouseOffset.x;
                                        break;
                                    case Side.TOP:
                                        glyph.src.y = editOriginal.src.y - mouseOffset.y;
                                        break;
                                    case Side.RIGHT:
                                        glyph.src.u = editOriginal.src.u - mouseOffset.x;
                                        break;
                                    case Side.BOTTOM:
                                        glyph.src.v = editOriginal.src.v - mouseOffset.y;
                                        break;
                                    default:
                                        glyph.src = new Box(
                                            editOriginal.src.x - mouseOffset.x,
                                            editOriginal.src.y - mouseOffset.y,
                                            editOriginal.src.u - mouseOffset.x,
                                            editOriginal.src.v - mouseOffset.y
                                        );
                                        break;
                                }
                            }
                        }
                    }
                }
                for (let glyph of metricsToDraw) {
                    let crossSize = Math.min(3, zoom / 5);
                    let dstOffset = new Box(
                        Math.floor((glyph.src.x - glyph.dst.x) * zoom + fixedOffset.x),
                        Math.floor((glyph.src.y - glyph.dst.y - font.ysize) * zoom + fixedOffset.y),
                        Math.floor((glyph.src.u - glyph.dst.x) * zoom + fixedOffset.x),
                        Math.floor((glyph.src.v - glyph.dst.y - glyph.src.height) * zoom + fixedOffset.y)
                    );
                    drawList.AddRectFilled(
                        new ImGui.Vec2(dstOffset.x, dstOffset.y),
                        new ImGui.Vec2(dstOffset.u, dstOffset.v),
                        ImGui.GetColorU32(new ImGui.Vec4(.25, 1., .5, .25))
                    );
                    drawList.AddRect(
                        new ImGui.Vec2(dstOffset.x, dstOffset.y),
                        new ImGui.Vec2(dstOffset.u, dstOffset.v),
                        ImGui.GetColorU32(new ImGui.Vec4(.125, 1., .25, 1.))
                    );
                    if (!wasEditing) {
                        ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(2, 2));
                        ImGui.BeginTooltip();
                        let charNumber = glyph.character.charCodeAt(0);
                        let drawnChar = charNumber >= 32 ? glyph.character : "?";
                        ImGui.Text(`Glyph: ${drawnChar} (U+${charNumber.toString(16).padStart(2, "0").toUpperCase()})`);
                        ImGui.Text(`Source UV: (${glyph.src.x}, ${glyph.src.y}), (${glyph.src.u}, ${glyph.src.v})`);
                        ImGui.Text(`Destination: ${glyph.dst.x}, ${glyph.dst.y}`);
                        ImGui.Text(`Delta: ${glyph.delta.x}, ${glyph.delta.y}`);
                        ImGui.Image(
                            texture,
                            new ImGui.Vec2((glyph.src.u - glyph.src.x) * 2, (glyph.src.v - glyph.src.y) * 2),
                            new ImGui.Vec2(glyph.src.x / imageSize.w, glyph.src.y / imageSize.h),
                            new ImGui.Vec2(glyph.src.u / imageSize.w, glyph.src.v / imageSize.h)
                        );
                        ImGui.EndTooltip();
                        ImGui.PopStyleVar();
                    }
                    if (glyph.drawingBBox.area > 0) {
                        drawList.AddRectFilled(
                            new ImGui.Vec2(glyph.drawingBBox.x, glyph.drawingBBox.y),
                            new ImGui.Vec2(glyph.drawingBBox.u, glyph.drawingBBox.v),
                            ImGui.GetColorU32(ImGui.Col.ButtonHovered, editingSide != null ? 0.2 : 0.3)
                        );
                        drawList.AddRect(
                            new ImGui.Vec2(glyph.drawingBBox.x, glyph.drawingBBox.y),
                            new ImGui.Vec2(glyph.drawingBBox.u, glyph.drawingBBox.v),
                            ImGui.GetColorU32(ImGui.Col.ButtonHovered, 0.7),
                            .0,
                            0,
                            editingSide != null ? Math.floor(zoom / 8) : 1
                        );
                    }
                    let RED = ImGui.GetColorU32(new ImGui.Vec4(1., 0., 0., 1.));
                    let glyphCornerPos = new Point(
                        Math.floor((glyph.src.x - glyph.dst.x) * zoom + fixedOffset.x),
                        Math.floor((glyph.src.y - glyph.dst.y) * zoom + fixedOffset.y)
                    );
                    drawList.AddLine(
                        new ImGui.Vec2(
                            Math.floor(glyphCornerPos.x + (glyph.delta.x * zoom) - 5 * crossSize),
                            Math.floor(glyphCornerPos.y + (glyph.delta.y * zoom))
                        ),
                        new ImGui.Vec2(
                            Math.ceil(glyphCornerPos.x + (glyph.delta.x * zoom) + 5 * crossSize),
                            Math.ceil(glyphCornerPos.y + (glyph.delta.y * zoom))
                        ),
                        RED,
                        Math.min(zoom / 5, 3)
                    );
                    drawList.AddLine(
                        new ImGui.Vec2(
                            Math.floor(glyphCornerPos.x + (glyph.delta.x * zoom)),
                            Math.floor(glyphCornerPos.y + (glyph.delta.y * zoom) - 5 * crossSize)
                        ),
                        new ImGui.Vec2(
                            Math.ceil(glyphCornerPos.x + (glyph.delta.x * zoom)),
                            Math.ceil(glyphCornerPos.y + (glyph.delta.y * zoom) + 5 * crossSize)
                        ),
                        RED,
                        Math.min(zoom / 5, 3)
                    );
                }
            }
            if (io.MouseDown[0] & io.KeyCtrl & io.KeyShift) {
                addGlyphOpen = true;
            }
            ImGui.End();
            if (stopEditing) {
                editOriginal = new Glyph();
                wasEditing = false;
                editingSide = null;
            }
        }
        ImGui.PopStyleVar();
        
        if (font != null & previewOpen) {
            // Box stores XYUV, not XYWH, so 2 points should be used instead
            let glyphsToDraw = [];
            let glyphPos = new Point();
            let glyphExtent = new Point();
            let deltaWarning = false;
            for (let char of testingString) {
                let index = char.charCodeAt(0);
                let currentGlyph = font.glyphs[index];
                let oldPos = glyphPos.copy();
                if (index == 0x09) {
                    glyphPos.x += font.glyphs[0x20].delta.x * 4; // Tab => 4 spaces
                } else if (index == 0x0A) {
                    glyphPos.x = 0;
                    glyphPos.y += font.ysize;
                } else {
                    if (
                        !(
                            (0x00 <= index & index < 0x100)
                        ) | 
                        index == 0x0D | // CR
                        index == 0x7F   // DEL
                    ) {
                        // Substitute for ?
                        index = 0x3F;
                        currentGlyph = font.glyphs[0x3F];
                    }
                    glyphPos.x += currentGlyph.delta.x;
                    glyphPos.y += currentGlyph.delta.y;
                }
                glyphExtent.x = Math.max(
                    glyphExtent.x + currentGlyph.dst.x, 
                    glyphPos.x + currentGlyph.dst.x + currentGlyph.src.width
                );
                glyphExtent.y = Math.max(
                    glyphExtent.y + currentGlyph.dst.y, 
                    glyphPos.y + font.ysize
                );
                glyphsToDraw.push({
                    "pos": new Point(
                        oldPos.x + currentGlyph.dst.x,
                        oldPos.y + font.ysize + currentGlyph.dst.y // Offset from other side
                    ),
                    "glyph": index
                });
                if (currentGlyph.delta.y != 0) {
                    deltaWarning = true;
                }
            }
            ImGui.SetNextWindowSize(ImGui.Vec2.ZERO, ImGui.Cond.Appearing);
            if (ImGui.Begin("Preview", (_ = previewOpen)=>previewOpen = _)) {
                ImGui.InputTextMultiline("String", (_ = testingString) => testingString = _, 65536, ImGui.Vec2.ZERO, ImGui.InputTextFlags.AllowTabInput);
                if (deltaWarning) {
                    let RED = new ImGui.Vec4(1., 0.3, 0.2, 1.); // THIS doesn't use an ImGui.ImU32 ????? 
                    ImGui.TextColored(
                        RED,
                        "Warning: Pixels below the unshifted y-axis boundaries are clipped when drawing the font!"
                    )
                    ImGui.TextColored(
                        RED,
                        "If you don't want this, set delta y to 0."
                    )
                }
                let originPos = ImGui.GetCursorPos();
                let menuOrigin = ImGui.GetWindowPos();
                originPos = new Point(originPos.x + menuOrigin.x, originPos.y + menuOrigin.y);
                ImGui.Dummy(new ImGui.Vec2(Math.max(200, glyphExtent.x), glyphExtent.y));
                let previewDrawList = ImGui.GetWindowDrawList();
                for (let glyph of glyphsToDraw) {
                    // Ignore non-drawn characters
                    if ([0x09, 0x7F, 0x0D, 0x0A].includes(glyph.glyph)) continue;
                    glyph.glyph = font.glyphs[glyph.glyph];
                    previewDrawList.AddImage(
                        texture,
                        new ImGui.Vec2(
                            originPos.x + glyph.pos.x, 
                            originPos.y + glyph.pos.y
                        ),
                        new ImGui.Vec2(
                            originPos.x + glyph.pos.x + glyph.glyph.src.width, 
                            originPos.y + glyph.pos.y + glyph.glyph.src.height
                        ),
                        new ImGui.Vec2(
                            (glyph.glyph.src.x) / imageSize.w, 
                            (glyph.glyph.src.y) / imageSize.h
                        ),
                        new ImGui.Vec2(
                            (glyph.glyph.src.u) / imageSize.w, 
                            (glyph.glyph.src.v) / imageSize.h
                        ),
                    );
                }
            }
            ImGui.End();
        }
        if (addGlyphOpen & font != null) {
            ImGui.SetNextWindowPos(new ImGui.Vec2(mousePos.x, mousePos.y), ImGui.Cond.Appearing);
            ImGui.SetNextWindowSize(ImGui.Vec2.ZERO, ImGui.Cond.Appearing);
            if (ImGui.Begin("Glyph Editor", (_ = addGlyphOpen)=>addGlyphOpen = _)) {
                let curPos = ImGui.GetCursorPos();
                ImGui.SetCursorPos(new ImGui.Vec2(curPos.x, curPos.y + 2.));
                ImGui.Text("Glyph: ");
                ImGui.SameLine(0.0, 0.0);
                curPos = ImGui.GetCursorPos();
                ImGui.SetCursorPos(new ImGui.Vec2(curPos.x, curPos.y - 2.));
                ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(0., 2.));
                ImGui.PushItemWidth(8);
                let addedCharString = String.fromCharCode(addedCharacter);
                let newCharString;
                ImGui.InputText("##charStrInput", (_ = addedCharString) => newCharString = _, 1, ImGui.InputTextFlags.NoHorizontalScroll);
                if (ImGui.IsItemEdited()) {
                    addedCharacter = newCharString.charCodeAt(0);
                }
                ImGui.PopItemWidth();
                ImGui.SameLine(0.0, 0.0);
                ImGui.Text(" (U+");
                ImGui.SameLine(0.0, 0.0);
                ImGui.PushItemWidth(15);
                let hexChar = addedCharacter.toString(16).padStart(2, "0").toUpperCase();
                let newHexChar;
                ImGui.InputText(
                    "##charHexInput", (_ = hexChar) => newHexChar = _, 2, 
                    ImGui.InputTextFlags.CharsHexadecimal | ImGui.InputTextFlags.NoHorizontalScroll
                );
                if (ImGui.IsItemEdited()) {
                    addedCharacter = parseInt(newHexChar, 16);
                }
                if (!isFinite(addedCharacter)) {
                    addedCharacter = 0;
                }
                ImGui.SameLine(0.0, 0.0);
                ImGui.Text(")")
                ImGui.SameLine();
                ImGui.Dummy(new ImGui.Vec2(4.0, 0.0));
                ImGui.SameLine();
                ImGui.PopItemWidth();
                ImGui.PushItemWidth(75);
                ImGui.InputInt("##charInt", (_ = addedCharacter) => addedCharacter = _);
                ImGui.PopItemWidth();
                ImGui.PopStyleVar();
                addedCharacter = (addedCharacter + 0x100) % 0x100;
                let selectedGlyph = font.glyphs[addedCharacter];
                ImGui.InputInt4("Source UV", selectedGlyph.src);
                ImGui.InputInt2("Destination", selectedGlyph.dst);
                ImGui.InputInt2("Delta", selectedGlyph.delta);
            }
            ImGui.End();
        }

        if (generatorOpen) {
            ImGui.SetNextWindowSize(ImGui.Vec2.ZERO, ImGui.Cond.Appearing);
            if (ImGui.Begin("Generate Mappings", (_ = generatorOpen)=>generatorOpen = _)) {
                ImGui.TextWrapped("This will override the current mappings with a grid.")
                ImGui.TextWrapped("In order to generate, UV Size must have a positive area, and a glyph atlas must be open (open one with File > Open.)")
                ImGui.InputInt("Line Height", (_ = genParams.ySize) => genParams.ySize = _);
                ImGui.InputInt2("Destination Offset", genParams.dst);
                ImGui.InputInt2("Delta Offset", genParams.delta);
                ImGui.InputInt2("UV Size", genParams.src);
                ImGui.Checkbox("Ignore control characters?", (_ = genParams.ignoreControl) => genParams.ignoreControl = _);
                if (!(genParams.src.x <= 0 | 
                    genParams.src.y <= 0 | 
                    imageSize.w == null |
                    imageSize.h == null)) {
                    if (ImGui.Button("Generate")) {
                        let columns = Math.floor(imageSize.w / genParams.src.x);
                        let x = 0;
                        let y = 0;
                        let iWithSkipped = 0;
                        for (let i = 0; i < 0x100; i++) {
                            if (!(genParams.ignoreControl & ((0 <= i & i < 0x20) | (0x7F <= i & i < 0xA0)))) {
                                x = iWithSkipped % columns;
                                y = Math.floor(iWithSkipped / columns);
                                iWithSkipped++;
                                font.glyphs[i] = new Glyph(
                                    String.fromCharCode(i),
                                    new Point(
                                        genParams.delta.x + genParams.src.x,
                                        genParams.delta.y
                                    ),
                                    new Box(
                                        x * genParams.src.x,
                                        y * genParams.src.y,
                                        (x + 1) * genParams.src.x,
                                        (y + 1) * genParams.src.y
                                    ),
                                    new Point(
                                        genParams.dst.x,
                                        genParams.dst.y - genParams.ySize
                                    )
                                );
                            }
                        }
                        font.ysize = genParams.ySize;
                    }
                } else {
                    ImGui.PushStyleVar(ImGui.StyleVar.Alpha, 0.3);
                    ImGui.Button("Generate");
                    ImGui.PopStyleVar();
                }
            }
            ImGui.End();
        }
        // Popups

        for (let popup of popups) {
            ImGui.OpenPopup(popup);
        }

        ImGui.SetNextWindowSize(ImGui.Vec2.ZERO, ImGui.Cond.Once);
        if (ImGui.BeginPopupModal("##openAlert")) {
            textCentered("In order to open a font, both a metadata file (.pil)");
            textCentered("and an atlas file (any image or .pbm)");
            textCentered("should be opened at once.");
            textCentered("It's possible to open one without the other,");
            textCentered("but you won't get much use out of it until you load");
            textCentered("the other half of the font.");
            ImGui.Dummy(new ImGui.Vec2(0, 7));
            textCentered("Also notable: a font will not open in PIL if it");
            textCentered("doesn't have a corresponding atlas in the same directory.");
            textCentered("(e.g. font.pil and font.pbm work)");
            textCentered("To add to this, the atlas must be saved");
            textCentered("with exactly 1 color channel.");
            let buttonSize = new ImGui.Vec2(Math.floor(ImGui.GetContentRegionAvail().x * 0.5) - 4, 0);
            if (ImGui.Button("Don't show me this again", buttonSize)) {
                window.localStorage.setItem("doNotShowOpen", 1);
                ImGui.CloseCurrentPopup();
                openFiles(fileInput).then(loadFiles);
            };
            ImGui.SameLine();
            if (ImGui.Button("Cancel", buttonSize)) {
                ImGui.CloseCurrentPopup();
            };
            ImGui.Dummy(new ImGui.Vec2(388, 0)); // Minimum size
            ImGui.EndPopup();
        }
        if (ImGui.BeginPopupModal("##openDynamicAlert")) {
            for (line of currentAlert.split(/\r?\n/)) {
                textCentered(line);
            }
            if (ImGui.Button("Close")) {
                ImGui.CloseCurrentPopup();
            };
            ImGui.EndPopup();
        }
        ImGui.SetNextWindowSize(ImGui.Vec2.ZERO, ImGui.Cond.Once);
        if (ImGui.BeginPopupModal("##newAlert")) {
            for (line of `Opening a new file will clear the current font.
Are you sure you want to do this?`.split(/\r?\n/)) {
                textCentered(line);
            }
            let buttonSize = new ImGui.Vec2(Math.floor(ImGui.GetContentRegionAvail().x * 0.5) - 4, 0);
            if (ImGui.Button("Ok", buttonSize)) {
                ImGui.CloseCurrentPopup();
                initFont();
            };
            ImGui.SameLine();
            if (ImGui.Button("Cancel", buttonSize)) {
                ImGui.CloseCurrentPopup();
            };
            ImGui.Dummy(new ImGui.Vec2(400, 0));
            ImGui.EndPopup();
        }

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
            setTimeout(() => {
                window.requestAnimationFrame(done ? _done : _loop);
            }, Math.max(frameDelta - lastFrameDeltas[0], 0));
        }
    }

    function _done() {
        ImGui_Impl.Shutdown();
        ImGui.DestroyContext();
    }

    const frameDelta = Math.floor(1000 / 60); // Max out at 60 fps for high refresh rate displays
    document.getElementById("delete").remove();
    window.requestAnimationFrame(_loop);
})();