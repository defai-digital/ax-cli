# Extension Resources

## Icons

- `icon.svg` - SVG icon for the extension (128x128)
- `icon.png` - PNG icon for VSCode marketplace (128x128)

## Generating PNG from SVG

To generate the PNG icon from SVG, you can use:

```bash
# Using ImageMagick
convert -density 300 -background none icon.svg -resize 128x128 icon.png

# Or using Inkscape
inkscape icon.svg --export-png=icon.png --export-width=128 --export-height=128

# Or using rsvg-convert
rsvg-convert -w 128 -h 128 icon.svg > icon.png

# Or online: https://cloudconvert.com/svg-to-png
```

For now, the SVG will work for development. A proper PNG can be generated later for marketplace submission.
