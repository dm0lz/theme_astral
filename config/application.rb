require_relative "boot"

require "rails/all"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module ThemeAstral
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.0

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    config.time_zone = 'Europe/Paris'
    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")
    
    # MCP SSE Proxy Middleware
    require 'rack/proxy'
    
    class McpSseProxy < Rack::Proxy
      def perform_request(env)
        request = Rack::Request.new(env)
        mcp_server_host = Rails.env.production? ? "theme_astral-swiss-ephemeris-mcp-server:8000" : "localhost:8000"
        # Only proxy /mcp requests
        if request.path == '/mcp'
          # Rewrite the environment to point to the MCP server
          env['HTTP_HOST'] = mcp_server_host
          env['rack.url_scheme'] = 'http'
          env['SERVER_NAME'] = mcp_server_host.split(':').first
          env['SERVER_PORT'] = mcp_server_host.split(':').last || '8000'

          env['PATH_INFO'] = '/mcp'
          env['REQUEST_PATH'] = '/mcp'
          
          # Call the parent perform_request to actually proxy the request
          super(env)
        else
          # Pass through to the next middleware for non-/mcp requests
          @app.call(env)
        end
      end
      
      def rewrite_response(triplet)
        status, headers, body = triplet
        
        # Add CORS headers
        headers['Access-Control-Allow-Origin'] = '*'
        headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, MCP-Session-ID'
        
        [status, headers, body]
      end
    end
    
    config.middleware.insert 0, McpSseProxy, backend: "http://#{Rails.env.production? ? "theme_astral-swiss-ephemeris-mcp-server:8000" : "localhost:8000"}"
  end
end
