from PIL import Image, ImageDraw

def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    r = size // 6
    draw.rounded_rectangle([r, r, size - r, size - r], radius=size // 6, fill='#3b82f6')
    margin = size // 4
    x1, y1 = margin, size * 0.55
    x2, y2 = size * 0.44, size * 0.75
    x3, y3 = size * 0.78, size * 0.28
    draw.line([(x1, y1), (x2, y2), (x3, y3)], fill='white', width=size // 14, joint='curve')
    return img

for sz in [192, 512]:
    img = create_icon(sz)
    img.save(f'icon-{sz}.png', 'PNG')
    print(f'icon-{sz}.png generated')
