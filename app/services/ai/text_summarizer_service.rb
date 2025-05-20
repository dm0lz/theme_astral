class Ai::TextSummarizerService < BaseService
  def call(text)
    task = "summarization"
    model = top_50[4]
    Ai::HuggingFace::PipelineService.new(task, model).call(text)[0]
  end

  def top_50
    [
      "facebook/bart-large-cnn",
      "google-t5/t5-small",
      "google-t5/t5-base",
      "google-t5/t5-11b",
      "sshleifer/distilbart-cnn-12-6",
      "google-t5/t5-large",
      "google-t5/t5-3b",
      "eenzeenee/t5-base-korean-summarization",
      "google/pegasus-xsum",
      "philschmid/bart-large-cnn-samsum",
      "Falconsai/text_summarization",
      "csebuetnlp/mT5_multilingual_XLSum",
      "pszemraj/long-t5-tglobal-base-sci-simplify",
      "cointegrated/rut5-base-absum",
      "google/pegasus-large",
      "optimum/t5-small",
      "sshleifer/distilbart-cnn-6-6",
      "suriya7/bart-finetuned-text-summarization",
      "utrobinmv/t5_summary_en_ru_zh_base_2048",
      "cnicu/t5-small-booksum",
      "knkarthick/MEETING_SUMMARY",
      "google/pegasus-cnn_dailymail",
      "kriton/greek-text-summarization",
      "facebook/bart-large-xsum",
      "lidiya/bart-large-xsum-samsum",
      "IlyaGusev/rut5_base_headline_gen_telegram",
      "IlyaGusev/mbart_ru_sum_gazeta",
      "EbanLee/kobart-summary-v3",
      "RussianNLP/FRED-T5-Summarizer",
      "cahya/t5-base-indonesian-summarization-cased",
      "google/bigbird-pegasus-large-arxiv",
      "transformer3/H2-keywordextractor",
      "human-centered-summarization/financial-summarization-pegasus",
      "d0rj/rut5-base-summ",
      "slauw87/bart_summarisation",
      "RUCAIBox/mvp",
      "mrm8488/bert-mini2bert-mini-finetuned-cnn_daily_mail-summarization",
      "wanderer-msk/ruT5-base_headline_generation",
      "VietAI/vit5-base",
      "echarlaix/t5-small-openvino",
      "thanathorn/mt5-cpe-kmutt-thai-sentence-sum",
      "IlyaGusev/rut5_base_sum_gazeta",
      "pszemraj/led-large-book-summary",
      "avisena/bart-base-job-info-summarizer",
      "nandakishormpai/t5-small-machine-articles-tag-generation",
      "pszemraj/led-base-book-summary",
      "pszemraj/long-t5-tglobal-base-16384-book-summary",
      "jolenechong/lora-bart-cnn-tib-1024",
      "recogna-nlp/ptt5-base-summ-xlsum",
      "Einmalumdiewelt/T5-Base_GNAD"
    ]
  end
end
