import ctypes
import math
import os
import stat
from pathlib import Path

import imgui
from imgui.integrations import sdl2
import sdl2.ext.image as sdl2image

import OpenGL.GL as gl

from .PILFont import PILFont
from .pythonized import *


def hidden(path):
    if os.name == "nt":
        return bool(os.stat(path).st_file_attributes & stat.FILE_ATTRIBUTE_HIDDEN)
    return path.stem.startswith(".") and path.stem != ".."


class Dialogue:
    def __init__(self, path: Path = Path.home()):
        self.dir: Path = path
        self.search: str = ""
        self.show_hidden: bool = False
        self.selected: str | None = None

    def explorer(self, extensions: tuple[str]):
        changed, value = imgui.input_text(
            "##directory",
            str(self.dir),
            65536
        )
        if changed:
            directory = Path(value)
            if directory.exists():
                self.dir = Path(value)
        imgui.separator()
        files = [f for f in self.dir.glob(f"*/") if f.is_dir()]
        for extension in extensions:
            files.extend(
                f for f in self.dir.glob(f"*.{extension}")
                if f.is_file()
            )
        imgui.columns(1)
        for file in [Path(".."), *sorted(files, key=lambda f: f"{int(f.is_file())}{f.name}")]:
            if file.name.startswith(self.search) and (not hidden(file) or self.show_hidden):
                if file.is_dir():
                    imgui.text_colored(file.name, 1.0, 1.0, 0.7)
                elif self.selected == file:
                    imgui.text_colored(
                        file.name,
                        *imgui.get_style_color_vec_4(imgui.COLOR_BUTTON_HOVERED)
                    )
                else:
                    imgui.text(file.name)
                if imgui.is_item_clicked():
                    if file.is_dir():
                        if file.name == "..":
                            self.dir = self.dir.parent
                        else:
                            self.dir /= file.name
                        self.selected = None
                        self.search = ""
                    else:
                        if self.selected == file:
                            self.selected = None
                            self.search = ""
                            return self.dir / file.name
                        else:
                            self.selected = file
                imgui.separator()

    def open(self, *, extensions: tuple[str] = ("*", )):
        available = imgui.get_content_region_available()
        line_size = imgui.get_text_line_height_with_spacing()
        spacing = (imgui.get_style().window_padding * 2)
        try:
            imgui.begin_child(
                "##open-explorer",
                height=available[1] - spacing[1] - line_size * 2.2,
                border=True
            )
            if (path := self.explorer(extensions)) is not None:
                return path
        finally:
            imgui.end_child()
            changed, value = imgui.input_text("Search", self.search, 65536)
            if changed:
                self.search = value
            imgui.same_line(available[0] - 100)
            _, self.show_hidden = imgui.checkbox("Show hidden?", self.show_hidden)
            imgui.text(f"Extensions: {','.join(extensions)}")
            imgui.same_line(available[0] - 40)
            if self.selected is not None and imgui.button("Open"):
                name = self.selected.name
                self.selected = None
                self.search = ""
                return self.dir / name
        return None


class Loop:
    def __init__(self, ctx, win, impl: sdl2.SDL2Renderer):
        self.ctx = ctx
        self.window = win
        self.impl: sdl2.SDL2Renderer = impl
        self.running: bool = True
        self.event = sdl2.SDL_Event()
        self.font: PILFont = PILFont()
        self.has_changed: bool = True
        self.dialogue: Dialogue = Dialogue()
        self.offset: tuple[float, float] = 0., 0.
        self.zoom: float = 1.
        self.pan_origin: tuple[float, float] | None = None
        self.pan_offset: tuple[float, float] | None = None
        self.font_id = gl.glGenTextures(1)
        self.io = imgui.get_io()
        gl.glBindTexture(gl.GL_TEXTURE_2D, self.font_id)
        gl.glTexParameteri(gl.GL_TEXTURE_2D, gl.GL_TEXTURE_MAG_FILTER, gl.GL_NEAREST)
        gl.glTexParameteri(gl.GL_TEXTURE_2D, gl.GL_TEXTURE_MIN_FILTER, gl.GL_NEAREST)

    def get_events(self):
        while sdl2.SDL_PollEvent(ctypes.byref(self.event)) != 0:
            yield self.event

    def start(self):
        button_color = imgui.get_style_color_vec_4(imgui.COLOR_BUTTON_HOVERED)[:3]
        while self.running:
            w = ctypes.c_int()
            h = ctypes.c_int()
            sdl2.SDL_GetWindowSize(self.window, w, h)
            window_size = (w.value, h.value)
            for event in self.get_events():
                if event.type == sdl2.SDL_QUIT:
                    self.running = False
                    break
                self.impl.process_event(event)
            self.impl.process_inputs()
            # https://peps.python.org/pep-0377/ was rejected >:/
            # wanted to make imgui.begin and the like use context managers but this makes that impossible
            with frame(self.impl, self.window):
                popups = []
                if imgui.begin_main_menu_bar():
                    if imgui.begin_menu("File", True):
                        clicked, selected = imgui.menu_item(
                            "Open", None, False, True
                        )
                        if clicked:
                            popups.append("Open File")
                        imgui.separator()
                        clicked, selected = imgui.menu_item(
                            "Quit", None, False, True
                        )
                        if clicked:
                            self.running = False
                        imgui.end_menu()
                    imgui.end_main_menu_bar()
                offset = int(imgui.get_text_line_height_with_spacing() + 2)
                imgui.set_next_window_size(window_size[0], window_size[1] - offset)
                imgui.set_next_window_position(0, offset)
                with imgui.styled(imgui.STYLE_WINDOW_PADDING, (0, 0)):
                    with imgui.styled(imgui.STYLE_WINDOW_BORDERSIZE, 0):
                        if imgui.begin(
                            "##main",
                            closable=False,
                            flags=imgui.WINDOW_NO_MOVE |
                            imgui.WINDOW_NO_RESIZE |
                            imgui.WINDOW_NO_SCROLLBAR |
                            imgui.WINDOW_NO_TITLE_BAR |
                            imgui.WINDOW_NO_SCROLL_WITH_MOUSE
                        ):
                            if imgui.is_window_focused():
                                raw_mx, raw_my = imgui.get_mouse_position()
                                raw_my -= offset
                                mx = ((raw_mx - self.offset[0]) / self.zoom)
                                my = ((raw_my - self.offset[1]) / self.zoom)
                                if abs(self.io.mouse_wheel) > 0:
                                    old_zoom = self.zoom
                                    self.zoom = 2 ** (math.log2(self.zoom) + (self.io.mouse_wheel * 2))
                                    delta_zoom = self.zoom - old_zoom
                                    self.offset = self.offset[0] + (-(mx * delta_zoom)), self.offset[1] + (-(my * delta_zoom))
                                if self.io.mouse_down[1]:  # Right mouse to pan
                                    if self.pan_origin is None:
                                        self.pan_origin = (raw_mx, raw_my)
                                        self.pan_offset = self.offset
                                    self.offset = (
                                        raw_mx - self.pan_origin[0] + self.pan_offset[0],
                                        raw_my - self.pan_origin[1] + self.pan_offset[1]
                                    )
                                elif self.pan_origin is not None:
                                    self.pan_origin = None
                                    self.pan_offset = None
                            draw_list = imgui.get_window_draw_list()
                            if self.font.atlas is not None:
                                atlas_w, atlas_h = self.font.atlas.size
                                draw_list.add_image(
                                    self.font_id,
                                    (
                                        int(self.offset[0]),
                                        int(self.offset[1] + offset)
                                    ),
                                    (
                                        int(self.offset[0] + atlas_w * self.zoom),
                                        int(self.offset[1] + atlas_h * self.zoom + offset)
                                    )
                                )
                                for glyph in self.font.glyphs:
                                    if glyph is not None:
                                        x1, y1, x2, y2 = glyph.src_bbox
                                        x1 = int(x1 * self.zoom + self.offset[0])
                                        y1 = int(y1 * self.zoom + self.offset[1] + offset)
                                        x2 = int(x2 * self.zoom + self.offset[0])
                                        y2 = int(y2 * self.zoom + self.offset[1] + offset)
                                        x, y = imgui.get_mouse_pos()
                                        x, y = int(x), int(y)
                                        if x in range(x1, x2) and y in range(y1, y2):
                                            draw_list.add_rect_filled(
                                                x1, y1, x2, y2,
                                                imgui.get_color_u32_rgba(*button_color, 0.3)
                                            )
                                            draw_list.add_rect(
                                                x1, y1, x2, y2,
                                                imgui.get_color_u32_rgba(*button_color, 0.7),
                                                thickness=0.25
                                            )
                                            with imgui.styled(imgui.STYLE_WINDOW_PADDING, (2, 2)):
                                                imgui.begin_tooltip()
                                                u1, v1, u2, v2 = glyph.src_bbox
                                                char = glyph.character.decode('utf-8', errors='chrdecode')
                                                imgui.text(f"Glyph: {char if ord(char) >= 32 else '?'} (U+{hex(ord(char))[2:].upper():>02})")
                                                imgui.text(f"Source UV: {glyph.src_bbox}")
                                                imgui.text(f"Offset: {glyph.dst_bbox}")
                                                imgui.image(
                                                    self.font_id,
                                                    (u2 - u1) * self.zoom,
                                                    (v2 - v1) * self.zoom,
                                                    (u1 / atlas_w, v1 / atlas_h),
                                                    (u2 / atlas_w, v2 / atlas_h),
                                                    border_color=(0., 0., 0., 1.)
                                                )
                                                imgui.end_tooltip()
                                        else:
                                            if self.zoom >= 1 and x1 != x2 and y1 != y2:
                                                draw_list.add_rect(
                                                    x1, y1, x2, y2,
                                                    imgui.get_color_u32_rgba(1., 1., 1., min(0.5, self.zoom / 8)),
                                                    thickness=0.25
                                                )
                                                draw_list.add_rect_filled(
                                                    x1, y1, x2, y2,
                                                    imgui.get_color_u32_rgba(1., 1., 1., min(0.125, self.zoom / 32)),
                                                )
                            imgui.end()
                print(self.zoom)
                for popup in popups:
                    imgui.set_next_window_size(
                        max(window_size[0] * 0.75, 200),
                        max(window_size[1] * 0.75, 160),
                        imgui.FIRST_USE_EVER
                    )
                    imgui.open_popup(popup)
                if imgui.begin_popup_modal(
                        "Open File",
                        True,
                        imgui.WINDOW_NO_MOVE |
                        imgui.WINDOW_NO_RESIZE
                )[0]:
                    if (path := self.dialogue.open(extensions=("pil",))) is not None:
                        image_path = None
                        for ext in ("pbm", "png", "bmp", "gif"):
                            maybe_image_path = path.parent / f"{path.stem}.{ext}"
                            if maybe_image_path.exists():
                                image_path = maybe_image_path
                                break
                        self.font = PILFont.load(path, image_path)
                        if self.font.atlas is not None:
                            width, height = self.font.atlas.size
                            gl.glTexImage2D(
                                gl.GL_TEXTURE_2D, 0, gl.GL_RGBA, width, height, 0, gl.GL_RGBA,
                                gl.GL_UNSIGNED_BYTE, self.font.atlas.convert("RGBA").tobytes()
                            )
                        imgui.close_current_popup()
                    imgui.end_popup()
