import { Scissors } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LogoProps {
    className?: string; // For text sizing/coloring
    iconClassName?: string; // For icon sizing/coloring
    iconSize?: number;
    showText?: boolean;
    to?: string; // Optional link destination (default: '/')
}

const Logo = ({
    className = "text-xl font-bold dark:text-white",
    iconClassName = "text-primary",
    iconSize = 24,
    showText = true,
    to = "/"
}: LogoProps) => {
    return (
        <Link to={to} className="flex items-center gap-2 group hover:opacity-90 transition-opacity">
            <div className={`flex items-center justify-center ${iconClassName}`}>
                <Scissors size={iconSize} className="transform -rotate-12 group-hover:rotate-0 transition-transform duration-300" />
            </div>
            {showText && (
                <span className={className}>
                    QueueLess
                </span>
            )}
        </Link>
    );
};

export default Logo;
