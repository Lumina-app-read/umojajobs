import { type LucideIcon } from 'lucide-react';
import { type ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { type ButtonIcons, type ButtonSize, type ButtonVariant, buttonClasses } from './button';

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, 'children'> &
  ButtonIcons & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    children: string;
  };

/**
 * Lien de navigation présenté comme un bouton (« Créer un compte », « Se connecter »).
 * Même règle que `Button` : une icône Lucide obligatoire, avant ou après le libellé.
 */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon: Icon,
  trailingIcon: TrailingIcon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link {...props} className={cn(buttonClasses(variant, size, fullWidth), className)}>
      {Icon && <ButtonIcon icon={Icon} />}
      {children}
      {TrailingIcon && <ButtonIcon icon={TrailingIcon} />}
    </Link>
  );
}

function ButtonIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-4" aria-hidden="true" />;
}
