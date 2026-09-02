-- Migration 013: Secure profiles table to prevent privilege escalation and unauthorized credit changes

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow bypassing if it's the service_role (auth.uid() is null in service role)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow bypassing if the user is a platform admin
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  -- Otherwise, prevent changing 'role'
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: Cannot change role without platform_admin privileges';
  END IF;

  -- Prevent changing 'credit_balance'
  IF NEW.credit_balance IS DISTINCT FROM OLD.credit_balance THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify credit balance directly';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles
DROP TRIGGER IF EXISTS tr_protect_profile_fields ON public.profiles;
CREATE TRIGGER tr_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_fields();
