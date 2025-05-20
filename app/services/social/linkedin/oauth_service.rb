class Social::Linkedin::OauthService

  def call
    require 'oauth2'

    client_id = ''
    client_secret = ''
    redirect_uri = 'https://theme-astral.me/auth/linkedin/callback'

    client = OAuth2::Client.new(
      client_id,
      client_secret,
      site: 'https://www.linkedin.com',
      authorize_url: '/oauth/v2/authorization',
      token_url: '/oauth/v2/accessToken'
    )

    auth_url = client.auth_code.authorize_url(
      redirect_uri: redirect_uri,
      scope: 'w_member_social profile openid',
      response_type: 'code'
    )

    puts "Open this URL in your browser:\n#{auth_url}"

    auth_code = '' # paste from browser

    token = client.auth_code.get_token(
      auth_code,
      redirect_uri: redirect_uri,
      # client_secret: client_secret
    )

    puts "Access token: #{token.token}"
    access_token = token.token

    uri = URI.parse("https://api.linkedin.com/v2/userinfo")
    request = Net::HTTP::Get.new(uri)
    request["Authorization"] = "Bearer #{access_token}"

    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
      http.request(request)
    end

    puts "Status: #{response.code}"
    puts "Body: #{response.body}"
    
  end
end