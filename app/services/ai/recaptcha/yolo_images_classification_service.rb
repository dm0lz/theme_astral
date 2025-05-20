class Ai::Recaptcha::YoloImagesClassificationService < BaseService
  def initialize(base64_images:, tiles_nb:, keyword:)
    @base64_images = base64_images # [{base64: "base64_image", tiles_nb: 9, is_grid: true, index: 0}]
    @tiles_nb = tiles_nb
    @keyword = keyword
  end

  def call
    puts python_script
    RuntimeExecutor::PythonService.new.call(python_script)
  end

  private

  def python_script
    # Escape the base64_images array as a JSON string for Python
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
      from ultralytics import YOLO

      logging.basicConfig(level=logging.DEBUG)
      logger = logging.getLogger(__name__)
      logging.getLogger("ultralytics").setLevel(logging.CRITICAL)

      # Input vars
      base64_images = json.loads("#{base64_images_json}")
      keyword = "#{@keyword}".lower()

      # Load YOLO model
      model = YOLO("yolov8x-cls.pt")  # Open Images V7 model
      logger.debug(f"Model classes: {model.names}")

      # Sort images by index to ensure consistent output order
      base64_images = sorted(base64_images, key=lambda x: x["index"])
      results = []

      for img_data in base64_images:
          img_base64 = img_data["base64"]
          tiles_nb = int(img_data["tiles_nb"])
          is_grid = img_data["is_grid"]
          index = img_data["index"]

          # Validate tiles_nb and index for grid-type images
          if is_grid:
              grid_size = int(math.sqrt(tiles_nb))
              if grid_size * grid_size != tiles_nb:
                  logger.error(f"Invalid tiles_nb {tiles_nb} at index {index}: must be a perfect square")
                  results.append({"error": "Invalid tiles_nb"})
                  continue
              if index < 0 or index >= tiles_nb:
                  logger.error(f"Invalid index {index} at index {index}: must be 0 to {tiles_nb-1}")
                  results.append({"error": "Invalid index"})
                  continue

          # Decode the base64 image
          try:
              image_data = base64.b64decode(img_base64)
          except Exception as e:
              logger.error(f"Failed to decode base64 image at index {index}: {e}")
              results.append({"error": "Invalid base64 image"})
              continue

          with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
              temp_file.write(image_data)
              temp_path = temp_file.name

          # Open the image
          try:
              image = Image.open(temp_path)
          except Exception as e:
              logger.error(f"Failed to open image at index {index}: {e}")
              results.append({"error": "Invalid image file"})
              os.remove(temp_path)
              continue

          # Process grid-type images: Resize to 1920x1920, crop, resize to 640x640
          if is_grid:
              # Resize to 1920x1920
              image = image.resize(
                  (1920, 1920),
                  Image.Resampling.LANCZOS
              )
              width, height = image.size

              # Calculate grid for cropping
              tile_width = width // grid_size
              tile_height = height // grid_size
              row = index // grid_size
              col = index % grid_size
              left = col * tile_width
              top = row * tile_height
              right = left + tile_width
              bottom = top + tile_height
              image = image.crop((left, top, right, bottom))
              logger.debug(f"Index {index}: Cropped tile at grid position ({row}, {col})")

              # Resize cropped tile to 640x640
              image = image.resize(
                  (640, 640),
                  Image.Resampling.LANCZOS
              )
          else:
              # Non-grid images: Resize directly to 640x640
              image = image.resize(
                  (640, 640),
                  Image.Resampling.LANCZOS
              )

          # Save the processed image for YOLO analysis
          with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as processed_file:
              image.save(processed_file.name)
              processed_path = processed_file.name
              logger.debug(f"Index {index}: Processed image saved at {processed_path}")

              # Run YOLO prediction
              preds = model(processed_path, conf=0.01)[0]

              # Get top-5 class indices
              # top5_ids = preds.probs.top5  # List of integers
              probs_tensor = preds.probs.data
              top15_ids = torch.topk(probs_tensor, 15).indices.tolist()
              names = preds.names          # List or dict of class names
              # Check if keyword is in any of the top-5 class names
              found = any(
                keyword in names[class_id].lower().replace("_", " ")
                for class_id in top15_ids
              )

              # names = preds.names
              # classes = preds.boxes.cls.tolist() if preds.boxes.cls is not None else []

              # Debug: Log detected classes
              # detected_classes = [names[int(cls)] for cls in classes]
              # logger.debug(f"Index {index}: Detected classes = {detected_classes}")

              # Single keyword matching
              # found = any(keyword in names[int(cls)].lower() for cls in classes)
              results.append(found)

              os.remove(processed_path)

          # Clean up original image
          os.remove(temp_path)

      print(json.dumps(results), flush=True)
    PYTHON
  end
end
