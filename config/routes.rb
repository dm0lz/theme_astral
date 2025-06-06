Rails.application.routes.draw do
  namespace :app do
    resources :chat_messages do
      collection do
        delete :clear
      end
    end
    resources :birth_charts
    resources :notebooks do
      resources :notes, except: [:index]
    end
    resources :notes
    root "birth_charts#index"
  end
  resource :session
  resources :passwords, param: :token
  resources :registrations, only: [:new, :create]
  namespace :public do
    resources :contacts, only: [:create, :new]
    get "landing_page/index"
    root "landing_page#index"
  end
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Defines the root path route ("/")
  get "/:id" => "public/seo_pages#show"
  root "public/landing_page#index"
end
