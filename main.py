import asyncio
import codecs

import imgui
from imgui.integrations import sdl2

from src.init import init_context
from src.loop import Loop

def chrdecode(exc):
    char = chr(ord(exc.object))
    return char, exc.end

def main():
    codecs.register_error("chrdecode", chrdecode)
    window, ctx = init_context(1280, 720)
    imgui.create_context()
    impl = sdl2.SDL2Renderer(window)
    running_loop = Loop(ctx, window, impl)
    with imgui.styled(imgui.STYLE_WINDOW_ROUNDING, 0):
        running_loop.start()
    impl.shutdown()
    sdl2.SDL_GL_DeleteContext(ctx)
    sdl2.SDL_DestroyWindow(window)
    sdl2.SDL_Quit()


if __name__ == "__main__":
    main()
