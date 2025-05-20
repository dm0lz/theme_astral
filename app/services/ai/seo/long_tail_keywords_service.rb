class Ai::Seo::LongTailKeywordsService < BaseService
  def call(keyword_id)
    CreateSeoKeywordsJob.perform_later(
      keyword_id: keyword_id,
      user_prompt: user_prompt(Keyword.find(keyword_id).name),
      system_prompt: system_prompt,
      response_schema: response_schema
    )
  end

  def response_schema
    {
      "strict": true,
      "name": "SEO_keywords_generator",
      "description": "Génère 10 mots-clés de longue traîne en français à partir du mot-clé donné.",
      "schema": {
        "type": "object",
        "properties": {
          "keywords": {
            "type": "array",
            "description": "Tableau d’objets, chacun contenant une liste de mots-clés longue traîne liés au mot-clé principal.",
            "items": {
              "type": "object",
              "properties": {
                "long_tail_keywords": {
                  "type": "array",
                  "description": "Une liste de 10 mots-clés de longue traîne pertinents pour le mot-clé donné.",
                  "items": {
                    "type": "string"
                  }
                }
              },
              "required": ["long_tail_keywords"],
              "additionalProperties": false
            }
          }
        },
        "required": ["keywords"],
        "additionalProperties": false
      }
    }
  end

  def user_prompt(keyword)
    <<~PROMPT
      Génère une liste de 10 mots-clés de longue traîne en français pour le mot-clé suivant : "#{keyword}".
      Les mots-clés doivent être pertinents pour un site spécialisé en astrologie.
      Utilise un langage naturel tel que recherché par les utilisateurs sur les moteurs de recherche.
      Les mots-clés doivent couvrir des intentions diverses (informationnelles, transactionnelles, etc.).
    PROMPT
  end

  def system_prompt
    <<~PROMPT
      Tu es un expert en référencement naturel (SEO) spécialisé dans la création de contenu en français.
      Ta tâche est de générer une liste de 10 mots-clés de longue traîne en rapport avec un mot-clé principal, dans le contexte d’un site d’astrologie.
      Ces mots-clés doivent refléter les recherches typiques des internautes, tout en étant utiles pour structurer une stratégie de contenu.
      Les mots-clés doivent être pertinents pour un site spécialisé en astrologie.
      Utilise un langage naturel tel que recherché par les utilisateurs sur les moteurs de recherche.
      Les mots-clés doivent couvrir des intentions diverses (informationnelles, transactionnelles, etc.).
    PROMPT
  end
end