class Ai::HuggingFace::ModelsService < BaseService
  def call(task, limit)
    url = URI.parse("https://huggingface.co/api/models?library=Transformers&filter=#{tasks[task]}&sort=downloads")
    response = Net::HTTP.get(url)
    models = JSON.parse(response)
    models.first(limit.to_i).map { |model| model["id"] }
  end

  def tasks
    [
      "any-to-any",
      "audio-classification",
      "audio-to-audio",
      "audio-text-to-text",
      "automatic-speech-recognition",
      "depth-estimation",
      "document-question-answering",
      "visual-document-retrieval",
      "feature-extraction",
      "fill-mask",
      "image-classification",
      "image-feature-extraction",
      "image-segmentation",
      "image-to-image",
      "image-text-to-text",
      "image-to-text",
      "keypoint-detection",
      "mask-generation",
      "object-detection",
      "video-classification",
      "question-answering",
      "reinforcement-learning",
      "sentence-similarity",
      "summarization",
      "table-question-answering",
      "tabular-classification",
      "tabular-regression",
      "text-classification",
      "text-generation",
      "text-to-image",
      "text-to-speech",
      "text-to-video",
      "token-classification",
      "translation",
      "unconditional-image-generation",
      "video-text-to-text",
      "visual-question-answering",
      "zero-shot-classification",
      "zero-shot-image-classification",
      "zero-shot-object-detection",
      "text-to-3d",
      "image-to-3d"
    ].map { |e| [ e, e ] }.to_h
  end
end
