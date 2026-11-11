-- Événements de sécurité liés aux finances (journal en ajout seul).
ALTER TYPE "security_event_type" ADD VALUE 'financial_setting_changed';
ALTER TYPE "security_event_type" ADD VALUE 'credits_granted';
