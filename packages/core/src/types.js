/**
 * Type documentation for the USPTO Bulk Search application.
 * These are JSDoc types — no runtime enforcement, just for editor hints.
 */

/**
 * @typedef {Object} Project
 * @property {number} id
 * @property {string} name
 * @property {string} created_at
 * @property {string} search_terms - JSON array of search terms
 * @property {string} storage_path - Relative path from data root
 * @property {string|null} notes
 */

/**
 * @typedef {Object} Assignment
 * @property {number} id
 * @property {number} project_id
 * @property {string|null} serial_number
 * @property {string|null} registration_number
 * @property {string|null} mark_text
 * @property {string|null} assignor
 * @property {string|null} assignee
 * @property {string|null} execution_date
 * @property {string|null} recorded_date
 * @property {string|null} reel_frame
 * @property {string} raw_data - Full JSON from USPTO
 * @property {string} fetched_at
 */

/**
 * @typedef {Object} Download
 * @property {number} id
 * @property {number} project_id
 * @property {string} filename
 * @property {string} file_path
 * @property {string} file_type
 * @property {number|null} file_size
 * @property {string|null} source_url
 * @property {string} downloaded_at
 * @property {string|null} content_text
 */

/**
 * @typedef {Object} ChainOfTitle
 * @property {string} markText
 * @property {string|null} serialNumber
 * @property {string|null} registrationNumber
 * @property {ChainEntry[]} entries
 * @property {string} currentOwner
 * @property {number} totalAssignments
 */

/**
 * @typedef {Object} ChainEntry
 * @property {number} step
 * @property {string} assignor
 * @property {string} assignee
 * @property {string} executionDate
 * @property {string} recordedDate
 * @property {string} reelFrame
 * @property {string|null} conveyanceText
 */

module.exports = {};
