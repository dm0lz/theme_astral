class Ai::Recaptcha::YoloImageClassificationService < BaseService
  def initialize(img_base64:, tiles_nb:, keyword:)
    @img_base64 = img_base64
    @tiles_nb = tiles_nb
    @keyword = keyword
  end

  def call
    puts python_script
    RuntimeExecutor::PythonService.new.call(python_script)
  end

  private

  def python_script
    <<-PYTHON
      import base64
      import tempfile
      import os
      import json
      import math
      from PIL import Image
      from ultralytics import YOLO
      import logging
      import torch
      import ipdb
      from sentence_transformers import SentenceTransformer, util

      logging.getLogger("ultralytics").setLevel(logging.CRITICAL)

      # Input vars
      img_base64 = "#{@img_base64}"
      tiles_nb = int(#{@tiles_nb})
      keyword = "#{@keyword}".lower()

      # Decode the base64 image
      image_data = base64.b64decode(img_base64)

      with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
          temp_file.write(image_data)
          temp_path = temp_file.name

      # Open and resize the image to a larger resolution
      image = Image.open(temp_path)
      large_resolution = 1920
      image = image.resize((large_resolution, large_resolution), Image.Resampling.LANCZOS)
      width, height = image.size

      # Calculate grid dimensions
      cols = rows = int(math.sqrt(tiles_nb))
      tile_width = width // cols
      tile_height = height // rows

      model = YOLO("yolov8x-cls.pt")
      embedder = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")
      keyword_embedding = embedder.encode(keyword, convert_to_tensor=True)

      results = []

      for row in range(rows):
          for col in range(cols):
              left = col * tile_width
              top = row * tile_height
              right = left + tile_width
              bottom = top + tile_height
              tile = image.crop((left, top, right, bottom))
              tile = tile.resize((640, 640), Image.Resampling.LANCZOS)

              with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tile_file:
                  tile.save(tile_file.name)
                  tile_path = tile_file.name

              preds = model(tile_path, conf=0.4)[0]
              names = preds.names
              probs_tensor = preds.probs.data
              top15_ids = torch.topk(probs_tensor, 15).indices.tolist()

              labels = [names[class_id].replace("_", " ") for class_id in top15_ids]
              label_embeddings = embedder.encode(labels, convert_to_tensor=True)

              similarities = util.pytorch_cos_sim(keyword_embedding, label_embeddings)[0]
              found = torch.max(similarities).item() >= 0.4
              # ipdb.set_trace()

              results.append(found)
              os.remove(tile_path)

      os.remove(temp_path)
      print(json.dumps(results), flush=True)
    PYTHON
  end
end
