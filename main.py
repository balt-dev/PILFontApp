import asyncio

import imgui
from imgui.integrations import sdl2

from src.init import init_context
from src.loop import Loop


def main():
    window, ctx = init_context(1280, 720)
    imgui.create_context()
    impl = sdl2.SDL2Renderer(window)
    running_loop = Loop(ctx, window, impl)
    running_loop.start()
    impl.shutdown()
    sdl2.SDL_GL_DeleteContext(ctx)
    sdl2.SDL_DestroyWindow(window)
    sdl2.SDL_Quit()


if __name__ == "__main__":
    main()
