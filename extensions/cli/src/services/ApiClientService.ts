import { getApiClient } from "../config.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { ApiClientServiceState } from "./types.js";

/**
 * Service for managing API client state
 * Provides access to the Continue SDK API client
 */
export class ApiClientService extends BaseService<ApiClientServiceState> {
  constructor() {
    super("ApiClientService", {
      apiClient: null,
    });
  }

  /**
   * Initialize the API client service
   */
  async doInitialize(): Promise<ApiClientServiceState> {
    const apiClient = getApiClient(undefined);

    return {
      apiClient,
    };
  }

  /**
   * Update the API client
   */
  async update(): Promise<ApiClientServiceState> {
    logger.debug("Updating ApiClientService");

    try {
      const apiClient = getApiClient(undefined);

      this.setState({
        apiClient,
      });

      logger.debug("ApiClientService updated successfully");
      return this.getState();
    } catch (error: any) {
      logger.error("Failed to update ApiClientService:", error);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Override isReady to check for API client
   */
  override isReady(): boolean {
    return super.isReady() && this.currentState.apiClient !== null;
  }
}
