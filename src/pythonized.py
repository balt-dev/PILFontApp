# This specific file is unlicensed, public domain. Use as you like.
from contextlib import contextmanager
import imgui
import OpenGL.GL as gl
from imgui.integrations import sdl2

__all__ = [
    'frame', 'window', 'group',
    'tooltip', 'collapsing_header'
]


@contextmanager
def frame(impl, win):
    imgui.new_frame()
    yield

    gl.glClearColor(0., 0., 0., 1)
    gl.glClear(gl.GL_COLOR_BUFFER_BIT)
    imgui.render()
    impl.render(imgui.get_draw_data())
    sdl2.SDL_GL_SwapWindow(win)
    imgui.end_frame()


@contextmanager
def window(label: str, closable: bool = False, flags: int = 0):
    imgui.begin(label, closable, flags)
    yield
    imgui.end()


@contextmanager
def group():
    imgui.begin_group()
    yield
    imgui.end_group()


@contextmanager
def tooltip():
    imgui.begin_tooltip()
    yield
    imgui.end_tooltip()


@contextmanager
def collapsing_header(text: str, visible: bool | None, flags: int = 0):
    expanded, visible = imgui.collapsing_header(text, visible, flags=flags)
    yield expanded
