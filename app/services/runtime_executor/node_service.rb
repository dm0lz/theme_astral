# Use double quotes only in the JS code
class RuntimeExecutor::NodeService < BaseService
  # def call(script)
  #   output, error, status = Open3.capture3(%Q(node -e '#{script.gsub("'", "").strip}'))
  #   if status.success?
  #     JSON.parse(output)
  #   else
  #     logger.error "Error: #{error}"
  #   end
  # end
  def call(script)
    temp_file = Tempfile.new([ "node_script", ".js" ])
    begin
      temp_file.write(script.strip)
      temp_file.close
      output, error, status = Open3.capture3("NODE_PATH=#{Rails.root.join("node_modules")} node #{temp_file.path}")
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
