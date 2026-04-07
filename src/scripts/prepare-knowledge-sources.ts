import KnowledgeSourceIngestionService from "@/api/v1/services/knowledge-source-ingestion.service";
import { readKnowledgeIngestionOptionsFromEnv } from "@/scripts/knowledge-ingestion-options.util";

async function main() {
  try {
    const options = readKnowledgeIngestionOptionsFromEnv();
    const summary =
      await KnowledgeSourceIngestionService.prepareKnowledgeSources(options);

    console.log(
      JSON.stringify(
        {
          success: true,
          mode: "prepare",
          summary,
        },
        null,
        2,
      ),
    );
  } finally {
    await KnowledgeSourceIngestionService.disconnect();
  }
}

void main();
