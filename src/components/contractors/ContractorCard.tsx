import { Phone, Mail, MapPin } from 'lucide-react';
import { StarRating } from '../ui/StarRating';

interface ContractorCardProps {
  contractor: {
    id: string;
    name: string;
    company: string;
    trade: string;
    phone: string;
    email: string;
    address: string;
    rating: number;
  };
  onClick: () => void;
}

export function ContractorCard({ contractor, onClick }: ContractorCardProps) {
  return (
    <div className="surface-hover" onClick={onClick}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
          >
            {contractor.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{contractor.name}</h3>
                {contractor.company && <p className="text-sm text-muted-foreground-2">{contractor.company}</p>}
              </div>
              <span className="badge badge-blue">
                {contractor.trade}
              </span>
            </div>
            <div className="mt-2">
              <StarRating rating={contractor.rating} size={14} />
            </div>
            <div className="mt-3 space-y-1">
              {contractor.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground-2">
                  <div className="w-8 h-8 rounded-full bg-[#4F6BFF]/10 text-[#4F6BFF] flex items-center justify-center flex-shrink-0">
                    <Phone size={13} />
                  </div>
                  <span>{contractor.phone}</span>
                </div>
              )}
              {contractor.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground-2">
                  <div className="w-8 h-8 rounded-full bg-[#4F6BFF]/10 text-[#4F6BFF] flex items-center justify-center flex-shrink-0">
                    <Mail size={13} />
                  </div>
                  <span className="truncate">{contractor.email}</span>
                </div>
              )}
              {contractor.address && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground-2">
                  <div className="w-8 h-8 rounded-full bg-[#4F6BFF]/10 text-[#4F6BFF] flex items-center justify-center flex-shrink-0">
                    <MapPin size={13} />
                  </div>
                  <span className="truncate">{contractor.address}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
