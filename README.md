# PILFontApp
 A small webapp to manipulate PIL fonts.
## TODO
- [x] Controls help menu
- [x] Redo a few things with classes
- [x] Tell user about 2-file load/save w/ Don't show me this again 
- [x] Testing window
- [ ] Glyph bound editing
  - [x] Click drag+drop in mid
    - [x] Handle drag/drop better, keep target if past bounds in single frmae
  - [x] Shift to move offset, control to move delta
  - [x] Change dst drawing to a box of dstOffset and dstOffset + WH of src
  - [ ] Fix placement of dstOffset box, it's off
  - [ ] Resize in outer
    - Highlight middle w/ move, outside line w/ resize
  - [ ] Some way of accessing 0x0 glyphs
        (glyphs on top of eachother work fine)
- [ ] Image replacement
- [ ] Default state, 16x16 grid with custom font
- [ ] Glyph saving
  - [ ] Grey out save for invalid states
  - [ ] Atlas does not need to be saved
- [ ] Add image to README