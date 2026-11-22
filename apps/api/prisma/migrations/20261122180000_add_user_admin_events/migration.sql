-- Journal de sécurité : suspension et réactivation d'un compte par l'administration.
ALTER TYPE "security_event_type" ADD VALUE 'user_suspended';
ALTER TYPE "security_event_type" ADD VALUE 'user_reactivated';
