class Public::ApplicationController < ApplicationController
  allow_unauthenticated_access
  layout "public_application"
end
