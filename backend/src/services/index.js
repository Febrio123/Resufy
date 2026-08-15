/**
 * Barrel service — satu pintu import untuk semua service.
 * Alasan: menghindari circular dependency antar service (mis. paymentService
 * memakai pdfService & cloudinaryService) dan menyederhanakan import controller.
 */
const cloudinaryService = require('./cloudinaryService');
const emailService = require('./emailService');
const atsService = require('./atsService');
const pdfService = require('./pdfService');
const similarityService = require('./similarityService');
const paymentService = require('./paymentService');
const toolboxService = require('./toolboxService');

module.exports = {
  cloudinaryService,
  emailService,
  atsService,
  pdfService,
  similarityService,
  paymentService,
  toolboxService,
};
