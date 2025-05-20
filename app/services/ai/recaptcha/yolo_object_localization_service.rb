class Ai::Recaptcha::YoloObjectLocalizationService < BaseService
  def initialize(img_base64:, tiles_nb:, keyword:)
    @img_base64 = img_base64
    @tiles_nb = tiles_nb
    @keyword = keyword
  end

  def call
    puts python_script
    RuntimeExecutor::PythonService.new.call(python_script)
  end

  def python_script
    <<-PYTHON
      import base64
      import tempfile
      import os
      import json
      import sys
      import contextlib
      from PIL import Image
      from ultralytics import YOLO
      import logging
      import math
      import ipdb

      logging.getLogger("ultralytics").setLevel(logging.CRITICAL)

      # Input vars
      img_base64 = "#{@img_base64}"
      tiles_nb = int(#{@tiles_nb})
      keyword = "#{@keyword}".lower()

      def box_iou(box1, box2):
          """Calculate IoU between two boxes: (x1, y1, x2, y2)"""
          xa1, ya1, xa2, ya2 = box1
          xb1, yb1, xb2, yb2 = box2

          inter_x1 = max(xa1, xb1)
          inter_y1 = max(ya1, yb1)
          inter_x2 = min(xa2, xb2)
          inter_y2 = min(ya2, yb2)

          inter_area = max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)
          area_a = (xa2 - xa1) * (ya2 - ya1)
          area_b = (xb2 - xb1) * (yb2 - yb1)

          union_area = area_a + area_b - inter_area
          if union_area == 0:
              return 0
          return inter_area / union_area

      def get_tiles_with_object(image_path, tiles_nb, keyword, model_path="yolov8x.pt", conf_threshold=0.6, iou_threshold=0.15):
          keyword = keyword.lower()
          model = YOLO(model_path)
          results = model(image_path, conf=conf_threshold)[0]
          names = results.names
          boxes = results.boxes
          tile_flags = [False] * tiles_nb

          if boxes is None or boxes.cls is None:
              return tile_flags

          image = Image.open(image_path)
          width, height = image.size
          grid_size = int(math.sqrt(tiles_nb))
          tile_w = width / grid_size
          tile_h = height / grid_size

          for i, cls_id in enumerate(boxes.cls.tolist()):
              label = names[int(cls_id)].lower().replace("_", " ")
              if keyword not in label:
                  continue

              x1, y1, x2, y2 = boxes.xyxy[i].tolist()

              for row in range(grid_size):
                  for col in range(grid_size):
                      tile_index = row * grid_size + col
                      tile_x1 = col * tile_w
                      tile_y1 = row * tile_h
                      tile_x2 = tile_x1 + tile_w
                      tile_y2 = tile_y1 + tile_h
                      tile_box = (tile_x1, tile_y1, tile_x2, tile_y2)

                      if box_iou((x1, y1, x2, y2), tile_box) > iou_threshold:
                          tile_flags[tile_index] = True

          return tile_flags

      image_data = base64.b64decode(img_base64)
      with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
          temp_file.write(image_data)
          temp_path = temp_file.name

      tiles = get_tiles_with_object(temp_path, tiles_nb, keyword)
      os.remove(temp_path)
      print(json.dumps(tiles), flush=True)
    PYTHON
  end
end
