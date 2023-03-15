import ctypes
import os
import stat
from pathlib import Path

import imgui
from imgui.integrations import sdl2

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

    def open(self, *, extensions: tuple[str] = ("*", )):
        if imgui.begin_menu_bar():
            changed, value = imgui.input_text(
                "##directory",
                str(self.dir),
                65536
            )
            if changed:
                directory = Path(value)
                if directory.exists():
                    self.dir = Path(value)
            imgui.end_menu_bar()
        available = imgui.get_content_region_available()
        line_size = imgui.get_text_line_height_with_spacing()
        spacing = (imgui.get_style().window_padding * 2)
        imgui.begin_child(
            "File Display",
            height=available[1] - spacing[1] - line_size,
            border=True
        )
        files = [*self.dir.glob(f"*/")]
        for extension in extensions:
            files.extend(
                f for f in self.dir.glob(f"*.{extension}")
                if f.is_file()
            )
        imgui.columns(1)
        try:
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
        finally:
            imgui.end_child()
            changed, value = imgui.input_text("Search", self.search, 65536)
            if changed:
                self.search = value
            imgui.same_line(available[0] - 100)
            _, self.show_hidden = imgui.checkbox("Show hidden?", self.show_hidden)
            imgui.dummy(0, 0)
            imgui.same_line(available[0] - 100)
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
        self.font: PILFont | None = None
        self.has_changed: bool = True
        self.dialogue: Dialogue = Dialogue()

    def get_events(self):
        while sdl2.SDL_PollEvent(ctypes.byref(self.event)) != 0:
            yield self.event

    def start(self):
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
                        imgui.WINDOW_MENU_BAR |
                        imgui.WINDOW_NO_MOVE |
                        imgui.WINDOW_NO_RESIZE
                )[0]:
                    if (path := self.dialogue.open()) is not None:
                        imgui.close_current_popup()
                    imgui.end_popup()
