# Use double quotes only in the JS code
class RuntimeExecutor::PythonService < BaseService
  def call(script)
    # output, error, status = Open3.capture3(%Q(uv run python -c '#{script.gsub(/^ {6}|'/, "")}'))
    # if status.success?
    #   JSON.parse(output)
    # else
    #   logger.error "Error: #{error}"
    # end
    temp_file = Tempfile.new([ "python_script", ".py" ])
    begin
      temp_file.write(script.gsub(/^ {6}/, ""))
      temp_file.close
      output, error, status = Open3.capture3("uv run #{temp_file.path}")
      if status.success?
        JSON.parse(output)
      else
        logger.error "Error executing script: #{error}"
        nil
      end
    rescue JSON::ParserError => e
      logger.error "Failed to parse output as JSON: #{e.message}"
      output
    ensure
      temp_file.unlink
    end
  end
end
