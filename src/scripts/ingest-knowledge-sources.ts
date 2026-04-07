import KnowledgeSourceIngestionService from "@/api/v1/services/knowledge-source-ingestion.service";
import { readKnowledgeIngestionOptionsFromEnv } from "@/scripts/knowledge-ingestion-options.util";

async function main() {
  try {
    const options = readKnowledgeIngestionOptionsFromEnv();
    const summary = await KnowledgeSourceIngestionService.ingestKnowledgeSources(
      options,
    );

    console.log(
      JSON.stringify(
        {
          success: true,
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
