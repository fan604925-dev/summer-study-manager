"""
生成 PWA 图标 (PNG)
使用标准库手动构造 PNG 文件，无需 Pillow
图标：蓝色圆角背景 + 白色对勾
"""
import zlib
import struct
import os


def png_chunk(chunk_type, data):
    chunk = chunk_type + data
    crc = zlib.crc32(chunk) & 0xffffffff
    return struct.pack('>I', len(data)) + chunk + struct.pack('>I', crc)


def create_icon(size, output_path):
    # 颜色
    bg = (59, 130, 246, 255)      # #3b82f6 蓝色
    white = (255, 255, 255, 255)

    # 对勾线段（相对坐标 0-1）
    p1 = (0.22, 0.52)
    p2 = (0.44, 0.74)
    p3 = (0.78, 0.28)
    thickness = size * 0.075

    def dist_to_segment(px, py, ax, ay, bx, by):
        # 点 (px,py) 到线段 AB 的距离
        dx = bx - ax
        dy = by - ay
        if dx == 0 and dy == 0:
            return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        projx = ax + t * dx
        projy = ay + t * dy
        return ((px - projx) ** 2 + (py - projy) ** 2) ** 0.5

    def pixel_color(x, y):
        # 圆角：如果靠近角落且超出圆角半径则透明
        r = size * 0.18
        cx, cy = None, None
        corners = [(r, r), (size - 1 - r, r), (r, size - 1 - r), (size - 1 - r, size - 1 - r)]
        for c in corners:
            if (x - c[0]) ** 2 + (y - c[1]) ** 2 > r * r:
                # 检查是否在该角落外
                if x < c[0] and y < c[1] and c[0] == r and c[1] == r:
                    return (0, 0, 0, 0)
                if x > c[0] and y < c[1] and c[0] == size - 1 - r and c[1] == r:
                    return (0, 0, 0, 0)
                if x < c[0] and y > c[1] and c[0] == r and c[1] == size - 1 - r:
                    return (0, 0, 0, 0)
                if x > c[0] and y > c[1] and c[0] == size - 1 - r and c[1] == size - 1 - r:
                    return (0, 0, 0, 0)

        # 对勾
        d1 = dist_to_segment(x, y, p1[0] * size, p1[1] * size, p2[0] * size, p2[1] * size)
        d2 = dist_to_segment(x, y, p2[0] * size, p2[1] * size, p3[0] * size, p3[1] * size)
        if d1 < thickness or d2 < thickness:
            return white
        return bg

    # 构造原始 RGBA 数据，每行以 filter byte 0 开头
    raw_rows = []
    for y in range(size):
        row = bytearray([0])  # filter: None
        for x in range(size):
            r, g, b, a = pixel_color(x, y)
            row.extend([r, g, b, a])
        raw_rows.append(bytes(row))

    raw_data = b''.join(raw_rows)
    compressed = zlib.compress(raw_data)

    # PNG 文件
    signature = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)  # RGBA
    ihdr = png_chunk(b'IHDR', ihdr_data)
    idat = png_chunk(b'IDAT', compressed)
    iend = png_chunk(b'IEND', b'')

    with open(output_path, 'wb') as f:
        f.write(signature + ihdr + idat + iend)


if __name__ == '__main__':
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
    os.makedirs(out_dir, exist_ok=True)
    create_icon(192, os.path.join(out_dir, 'icon-192.png'))
    create_icon(512, os.path.join(out_dir, 'icon-512.png'))
    print(f'Icons created in {out_dir}')
