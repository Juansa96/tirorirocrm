import numpy as np
from PIL import Image, ImageFilter
def blur_cols(a, r=3):
    im=Image.fromarray(np.clip(a,0,255).astype("uint8")); return np.asarray(im.filter(ImageFilter.GaussianBlur(r)),float)
