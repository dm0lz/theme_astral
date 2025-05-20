class Ai::Recaptcha::ImagesClassificationService < BaseService
  MUTEX = Mutex.new
  def initialize(base64_images:, tiles_nb:, keyword:)
    @base64_images = base64_images
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
    base64_images_json = @base64_images.to_json.gsub('"', '\"')
    <<-PYTHON
      import base64
      import tempfile
      import os
      import json
      import sys
      import logging
      import math
      import torch
      from PIL import Image
      from transformers import CLIPProcessor, CLIPModel

      logging.basicConfig(level=logging.DEBUG)
      logger = logging.getLogger(__name__)
      logging.getLogger("transformers").setLevel(logging.ERROR)

      base64_images = json.loads("#{base64_images_json}")
      keyword = "#{@keyword}".lower()

      model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
      processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

      base64_images = sorted(base64_images, key=lambda x: x["index"])
      results = []

      for img_data in base64_images:
          img_base64 = img_data["base64"]
          tiles_nb = int(img_data["tiles_nb"])
          is_grid = img_data["is_grid"]
          index = img_data["index"]

          if is_grid:
              logger.debug(f"Index {index}: is_grid is true, skipping processing and returning false")
              results.append(False)
              continue

          try:
              image_data = base64.b64decode(img_base64)
          except Exception as e:
              logger.error(f"Failed to decode base64 image at index {index}: {e}")
              results.append({"error": "Invalid base64 image"})
              continue

          with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
              temp_file.write(image_data)
              temp_path = temp_file.name

          try:
              image = Image.open(temp_path)
          except Exception as e:
              logger.error(f"Failed to open image at index {index}: {e}")
              results.append({"error": "Invalid image file"})
              os.remove(temp_path)
              continue

          image = image.resize((640, 640), Image.Resampling.LANCZOS)

          labels = ["car", "crosswalk", "traffic light", "bus", "bicycle", "motorcycle", "fire hydrant", "stair"]
          if keyword not in labels:
              labels.append(keyword)

          inputs = processor(text=labels, images=image, return_tensors="pt", padding=True)
          outputs = model(**inputs)
          probs = outputs.logits_per_image.softmax(dim=1)
          found = (probs[0][labels.index(keyword)].item() >= 0.5)

          results.append(found)
          os.remove(temp_path)

      print(json.dumps(results), flush=True)
    PYTHON
  end
end
