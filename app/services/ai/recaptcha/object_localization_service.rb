class Ai::Recaptcha::ObjectLocalizationService < BaseService
  MUTEX = Mutex.new

  def initialize(img_base64:, tiles_nb:, keyword:)
    @img_base64 = img_base64
    @tiles_nb = tiles_nb
    @keyword = keyword
  end

  def call
    MUTEX.synchronize do
      puts(python_script) # for debugging
      RuntimeExecutor::PythonService.new.call(python_script)
    end
  end

  def python_script
    <<-PYTHON
      import base64
      import tempfile
      import os
      import json
      import math
      from PIL import Image, ImageDraw
      import torch
      from transformers import AutoProcessor, GroundingDinoForObjectDetection
      import ipdb

      img_base64 = "#{@img_base64}"
      tiles_nb = int(#{@tiles_nb})
      keyword = "a #{@keyword} or #{@keyword.pluralize}".lower()

      # Decode base64 image
      image_data = base64.b64decode(img_base64)
      with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
          temp_file.write(image_data)
          temp_path = temp_file.name

      # Load image
      base_image = Image.open(temp_path).convert("RGB")
      width, height = base_image.size
      grid_size = int(math.sqrt(tiles_nb))
      tile_w, tile_h = width / grid_size, height / grid_size

      # Load model
      processor = AutoProcessor.from_pretrained("IDEA-Research/grounding-dino-base")
      model = GroundingDinoForObjectDetection.from_pretrained("IDEA-Research/grounding-dino-base").to(
          "cuda" if torch.cuda.is_available() else "cpu"
      )

      def detect(box_threshold, text_threshold):
          image = base_image.copy()
          inputs = processor(images=image, text=keyword, return_tensors="pt").to(model.device)
          with torch.no_grad():
              outputs = model(**inputs)
          results = processor.post_process_grounded_object_detection(
              outputs=outputs,
              input_ids=inputs.input_ids,
              threshold=box_threshold,
              text_threshold=text_threshold,
              target_sizes=[image.size[::-1]]
          )[0]

          tile_flags = [False] * tiles_nb
          overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
          draw_grid = ImageDraw.Draw(image)
          draw_overlay = ImageDraw.Draw(overlay)

          for i in range(1, grid_size):
              draw_grid.line([(i * tile_w, 0), (i * tile_w, height)], fill="white", width=1)
              draw_grid.line([(0, i * tile_h), (width, i * tile_h)], fill="white", width=1)

          for box in results["boxes"]:
              x1, y1, x2, y2 = box.tolist()
              draw_grid.rectangle([x1, y1, x2, y2], outline="red", width=3)
              for row in range(grid_size):
                  for col in range(grid_size):
                      idx = row * grid_size + col
                      tx1, ty1 = col * tile_w, row * tile_h
                      tx2, ty2 = tx1 + tile_w, ty1 + tile_h
                      inter_x1, inter_y1 = max(x1, tx1), max(y1, ty1)
                      inter_x2, inter_y2 = min(x2, tx2), min(y2, ty2)
                      if (max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)) / (tile_w * tile_h) > 0.15:
                          tile_flags[idx] = True
                          draw_overlay.rectangle([tx1, ty1, tx2, ty2], fill=(0, 255, 0, 100))

          return tile_flags, Image.alpha_composite(image.convert("RGBA"), overlay)

      # Threshold search
      box_thresh, text_thresh = 0.3, 0.2

      while box_thresh >= 0.01 and text_thresh >= 0.01:
          tile_flags, final_image = detect(box_thresh, text_thresh)
          if any(tile_flags):
              break
          if box_thresh > 0.05:
              box_thresh -= 0.05
              text_thresh -= 0.05
          else:
              box_thresh -= 0.01
              text_thresh -= 0.01

      # Save debug image
      vis_path = temp_path.replace(".png", "_boxes.png")
      final_image.save(vis_path)

      # ipdb.set_trace()
      os.remove(temp_path)
      os.remove(vis_path)

      print(json.dumps(tile_flags), flush=True)
    PYTHON
  end
end
