-- Migration 012: Remove 'ticket_to_fix' task type
-- Reassign all incidents with screen='ticket_to_fix' to screen='problem_to_fix'.
-- source is left unchanged so tasks remain in whichever tab they came from.

UPDATE incidents
SET screen = 'problem_to_fix'
WHERE screen = 'ticket_to_fix';
