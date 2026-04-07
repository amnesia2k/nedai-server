const LOCAL_EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";

class EmbeddingServiceImpl {
  private localPipeline: Promise<any> | null = null;

  private async getLocalPipeline() {
    if (!this.localPipeline) {
      this.localPipeline = import("@xenova/transformers").then(
        async ({ pipeline }) =>
          pipeline("feature-extraction", LOCAL_EMBEDDING_MODEL),
      );
    }

    return this.localPipeline;
  }

  public async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const extractor = await this.getLocalPipeline();
    const result = await extractor(texts, {
      pooling: "mean",
      normalize: true,
    });

    return result.tolist();
  }

  public async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.embedTexts([text]);
    return embedding ?? [];
  }
}

const EmbeddingService = new EmbeddingServiceImpl();

export default EmbeddingService;
