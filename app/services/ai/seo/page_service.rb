class Ai::Seo::PageService < BaseService
  def call(keyword, pillar = nil)
    Ai::Openai::ChatGptService.new.call(
      user_prompt: user_prompt(keyword, pillar),
      system_prompt: system_prompt,
      response_schema: response_schema
    )
  end

  # Invite ChatGPT to generate a French SEO page focused on astrology
  def user_prompt(keyword, pillar = nil)
    link_instruction =
      if pillar.present?
        "- Le code HTML doit inclure un lien vers https://www.theme-astral.me/#{pillar.to_s.parameterize}"
      else
        "- Le code HTML doit inclure un lien ancré vers https://www.theme-astral.me/#order"
      end

    <<~PROMPT
      Crée une page SEO bien optimisée en français ciblant le mot-clé "#{keyword}".
      Cette page s'adresse à un public intéressé par l'astrologie et souhaitant s'informer sur ce sujet.
      Voici les consignes à respecter :
      - La balise meta title doit être concise (moins de 60 caractères) et inclure le mot-clé.
      - La meta description doit être claire (moins de 160 caractères) et inclure le mot-clé.
      - Le titre H1 de la page doit être informatif et contenir le mot-clé.
      - Le contenu doit comporter entre 800 et 1500 mots, être engageant et instructif.
      - Le mot-clé doit apparaître dans les 100 premiers mots du contenu.
      - Utilise le mot-clé de manière naturelle, sans le répéter excessivement.
      - Le contenu doit être fluide, pertinent et optimisé pour le référencement naturel.
      - Le contenu doit être du code HTML encapsulé dans des balises <section>.
      - Le HTML doit être valide et correctement structuré.
      - Le contenu HTML doit respecter les bonnes pratiques SEO et d'accessibilité.
      - Utilise Tailwind CSS pour le style du HTML.
      - Le HTML doit être responsive et adapté aux mobiles.
      - Le html ne doit pas modifier le background-color de la page.
      - Ne pas utiliser de balise h1 dans le HTML. Le titre principal doit être différent du titre HTML ou des sous-titres.
      - Aère le contenu avec des paragraphes et utilise un ton professionnel, chaleureux et accessible pour un public curieux d'en savoir plus sur "#{keyword}".
      - Utilise les classes text-gray-300 pour le texte sur un fond bg-transparent.
      - Utilise text-gray-100 pour les titres et sous-titres.
      - Utilise la police font-sans.
      #{link_instruction}
    PROMPT
  end

  # Guide système en français pour un agent spécialisé en SEO & contenu astrologique
  def system_prompt
    <<~PROMPT
      Tu es un expert en SEO et en rédaction de contenu en français, spécialisé dans l'astrologie.
      Ta mission est de générer une page optimisée pour le référencement naturel à partir d'un mot-clé donné.
      Le contenu doit être engageant, informatif, bien structuré et conforme aux meilleures pratiques SEO tout en étant plaisant à lire.
      Assure-toi que toutes les balises (meta, titres, contenu) sont optimisées pour les moteurs de recherche tout en restant naturelles et attrayantes pour le lecteur.
    PROMPT
  end

  def response_schema
    {
      "strict": true,
      "name": "SEO_Page_Generator",
      "description": "Génère une page SEO optimisée en français autour d’un mot-clé spécifique",
      "schema": {
        "type": "object",
        "properties": {
          "meta_title": {
            "type": "string",
            "description": "Balise meta title, moins de 60 caractères, incluant le mot-clé"
          },
          "meta_description": {
            "type": "string",
            "description": "Meta description, moins de 160 caractères, incluant le mot-clé"
          },
          "headline": {
            "type": "string",
            "description": "Titre H1 de la page, en lien avec le mot-clé"
          },
          "subheading": {
            "type": "string",
            "description": "Sous-titre de la page, en lien avec le mot-clé"
          },
          "content": {
            "type": "string",
            "description": "Contenu principal (800 à 1500 mots). Le mot-clé doit apparaître dans les 100 premiers mots."
          }
        },
        "additionalProperties": false,
        "required": ["meta_title", "meta_description", "headline", "subheading", "content"]
      }
    }
  end
end