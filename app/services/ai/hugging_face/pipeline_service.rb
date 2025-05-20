class Ai::HuggingFace::PipelineService < BaseService
  def initialize(task, model)
    @task = task
    @model = model
  end

  def call(input)
    RuntimeExecutor::PythonService.new.call(python_script(input))
  end

  private
  def python_script(input)
    <<-PYTHON
      import json
      from transformers import pipeline

      pipe = pipeline("#{@task}", model="#{@model}")
      output = pipe("#{input.gsub(/[\n"]/, " ")}")

      print(json.dumps(output, indent=2))
    PYTHON
  end
end
