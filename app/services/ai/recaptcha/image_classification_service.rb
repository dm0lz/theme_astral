class Ai::Recaptcha::ImageClassificationService < BaseService
  MUTEX = Mutex.new
  def initialize(img_base64:, tiles_nb:, keyword:)
    @img_base64 = img_base64
    @tiles_nb = tiles_nb
    @keyword = keyword
  end

  def call
    MUTEX.synchronize do
      puts python_script
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
      from PIL import Image
      from transformers import CLIPProcessor, CLIPModel
      import torch
      import logging
      import ipdb

      logging.getLogger("transformers").setLevel(logging.ERROR)

      # Input vars
      img_base64 = "#{@img_base64}"
      tiles_nb = int(#{@tiles_nb})
      keyword = "#{@keyword}".lower()

      # Decode the base64 image
      image_data = base64.b64decode(img_base64)
      with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
          temp_file.write(image_data)
          temp_path = temp_file.name

      # Open and resize image
      image = Image.open(temp_path)
      large_resolution = 1920
      image = image.resize((large_resolution, large_resolution), Image.Resampling.LANCZOS)
      width, height = image.size

      cols = rows = int(math.sqrt(tiles_nb))
      tile_width = width // cols
      tile_height = height // rows

      # Load CLIP
      model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
      processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

      results = []

      for row in range(rows):
          for col in range(cols):
              left = col * tile_width
              top = row * tile_height
              right = left + tile_width
              bottom = top + tile_height
              tile = image.crop((left, top, right, bottom))

              with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tile_file:
                  tile.save(tile_file.name)
                  tile_path = tile_file.name

              labels = ["car", "crosswalk", "traffic light", "bus", "bicycle", "motorcycle", "fire hydrant", "stair"]
              if keyword not in labels:
                  labels.append(keyword)

              inputs = processor(text=labels, images=tile, return_tensors="pt", padding=True)
              outputs = model(**inputs)
              probs = outputs.logits_per_image.softmax(dim=1)
              found = (probs[0][labels.index(keyword)].item() >= 0.5)
              # ipdb.set_trace()

              results.append(found)
              os.remove(tile_path)

      os.remove(temp_path)
      print(json.dumps(results), flush=True)
    PYTHON
  end
end
