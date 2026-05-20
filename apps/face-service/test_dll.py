import os
import sys

torch_lib_path = r'C:\Users\maana\Desktop\Praverse\EMS\nexgen-ems\apps\face-service\venv\Lib\site-packages\torch\lib'
os.environ['PATH'] = torch_lib_path + ';' + os.environ.get('PATH', '')
try:
    os.add_dll_directory(torch_lib_path)
except AttributeError:
    pass

import torch
print("Torch imported successfully:", torch.__version__)
