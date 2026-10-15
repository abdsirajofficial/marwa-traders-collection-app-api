import * as correctionService from '../services/correctionService.js';
import { successResponse } from '../utils/response.js';

export async function getCorrections(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await correctionService.getCorrections({
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function reviewCorrection(req, res, next) {
  try {
    const { status, reviewNotes } = req.body;
    const result = await correctionService.reviewPaymentCorrection({
      correctionId: req.params.id,
      status,
      reviewNotes,
      reviewer: req.user,
    });
    return successResponse(res, result, 200, `Correction request ${status.toLowerCase()}`);
  } catch (error) {
    next(error);
  }
}
