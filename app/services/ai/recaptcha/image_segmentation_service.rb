class Ai::Recaptcha::ImageSegmentationService < BaseService
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
      import math
      import tempfile
      import json
      from PIL import Image, ImageDraw
      import torch
      from transformers import AutoProcessor, GroundingDinoForObjectDetection, SamProcessor, SamModel
      import numpy as np
      import os
      import uuid

      # Setup
      tiles_nb = #{@tiles_nb}
      keyword = "one #{@keyword} or many #{@keyword.pluralize}".lower()

      # Decode image
      image_data = base64.b64decode("#{@img_base64}")
      with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
          temp_file.write(image_data)
          temp_path = temp_file.name

      # Load image
      base_image = Image.open(temp_path).convert("RGB")
      width, height = base_image.size
      grid_size = int(math.sqrt(tiles_nb))
      tile_w, tile_h = width / grid_size, height / grid_size

      # Load models
      processor_dino = AutoProcessor.from_pretrained("IDEA-Research/grounding-dino-tiny")
      model_dino = GroundingDinoForObjectDetection.from_pretrained(
          "IDEA-Research/grounding-dino-base"
      ).to("cuda" if torch.cuda.is_available() else "cpu")

      processor_sam = SamProcessor.from_pretrained("facebook/sam-vit-base")
      model_sam = SamModel.from_pretrained("facebook/sam-vit-base").to(
          "cuda" if torch.cuda.is_available() else "cpu"
      )

      def detect_and_segment(box_threshold, text_threshold):
          tile_flags = [False] * tiles_nb

          # Visualization images
          vis_image = base_image.copy().convert("RGBA")
          overlay = Image.new("RGBA", vis_image.size, (0, 0, 0, 0))
          draw = ImageDraw.Draw(vis_image)
          draw_overlay = ImageDraw.Draw(overlay)

          # Run GroundingDINO
          inputs_dino = processor_dino(
              images=base_image, text=keyword, return_tensors="pt"
          ).to(model_dino.device)
          with torch.no_grad():
              outputs_dino = model_dino(**inputs_dino)
          results = processor_dino.post_process_grounded_object_detection(
              outputs=outputs_dino,
              input_ids=inputs_dino.input_ids,
              threshold=box_threshold,
              text_threshold=text_threshold,
              target_sizes=[base_image.size[::-1]],
          )[0]

          if results["boxes"] is None or len(results["boxes"]) == 0:
              return tile_flags, vis_image

          # Prepare SAM input
          input_boxes = results["boxes"].clone().detach().unsqueeze(0).to(model_sam.device)
          inputs_sam = processor_sam(
              base_image, input_boxes=input_boxes, return_tensors="pt"
          ).to(model_sam.device)
          with torch.no_grad():
              outputs_sam = model_sam(**inputs_sam)
          masks = outputs_sam.pred_masks.squeeze(1).cpu()  # (num_masks, height, width)

          # Draw masks and bounding boxes
          for box, mask in zip(results["boxes"], masks):
              # Draw bounding box
              x1, y1, x2, y2 = box.tolist()
              draw.rectangle([x1, y1, x2, y2], outline="red", width=3)

              # Process mask
              mask_np = mask.detach().cpu().numpy()

              # Handle 4D input (batch, channel, h, w)
              if mask_np.ndim == 4:
                  mask_np = mask_np[0]  # Remove batch

              # Handle 3D input (channel, h, w)
              if mask_np.ndim == 3:
                  if mask_np.shape[0] > 1:
                      mask_np = np.max(mask_np, axis=0)  # Merge channels
                  else:
                      mask_np = mask_np[0]  # Single channel

              # Now mask_np must be 2D
              h, w = mask_np.shape
              mask_np = (mask_np > 0).astype(np.uint8) * 255

              mask_img = Image.fromarray(mask_np, mode="L").resize((width, height), Image.NEAREST)
              mask_rgba = Image.new("RGBA", mask_img.size, (0, 255, 0, 100))
              overlay.paste(mask_rgba, (0, 0), mask_img)

          # Check tile overlaps
          masks_np = masks.detach().cpu().numpy()  # Convert masks to numpy
          masks_np = (masks_np > 0).astype(np.uint8)
          # Combine masks by taking logical OR across mask dimension
          combined_mask = np.any(
              masks_np, axis=0
          )  # Shape: (height, width)
          if combined_mask.ndim == 3:
              combined_mask = combined_mask[0]  # Take first channel if 3D
          combined_mask = combined_mask.astype(np.uint8)

          # Resize mask to image dimensions if needed
          if combined_mask.shape != (height, width):
              # Ensure combined_mask is squeezed and in the correct format
              # combined_mask = combined_mask[0, 0]
              combined_mask = combined_mask.squeeze()  # Remove any extra dimensions (e.g., from shape (1, 1, 256, 256) to (256, 256))
              if combined_mask.shape != (256, 256):
                  combined_mask = combined_mask[0, 0]

              # Ensure binary mask (values 0 or 255)
              combined_mask = (combined_mask > 0).astype(np.uint8) * 255

              # Resize the mask to match the image dimensions
              combined_mask = np.array(
                  Image.fromarray(combined_mask).resize((width, height), Image.NEAREST)
              )
          combined_mask = combined_mask > 0  # Ensure binary

          for row in range(grid_size):
              for col in range(grid_size):
                  idx = row * grid_size + col
                  x1, y1 = int(col * tile_w), int(row * tile_h)
                  x2, y2 = int(x1 + tile_w), int(y1 + tile_h)
                  tile_mask = combined_mask[y1:y2, x1:x2]
                  if np.any(tile_mask):
                      tile_flags[idx] = True

          # Draw grid
          for i in range(1, grid_size):
              draw.line([(i * tile_w, 0), (i * tile_w, height)], fill="white", width=1)
              draw.line([(0, i * tile_h), (width, i * tile_h)], fill="white", width=1)

          return tile_flags, Image.alpha_composite(vis_image, overlay)

      # Threshold search
      box_thresh, text_thresh = 0.3, 0.2
      while box_thresh >= 0.01 and text_thresh >= 0.01:
          tile_flags, final_image = detect_and_segment(box_thresh, text_thresh)
          if any(tile_flags):
              break
          if box_thresh > 0.05:
              box_thresh -= 0.05
              text_thresh -= 0.05
          else:
              box_thresh -= 0.01
              text_thresh -= 0.01

      # Save visualization
      vis_path = f"python_scripts/images/{str(uuid.uuid4())}.png"
      final_image.save(vis_path)

      # Cleanup
      os.remove(temp_path)

      # Output tile flags
      print(json.dumps(tile_flags), flush=True)
    PYTHON
  end
end
