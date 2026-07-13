import React from 'react';
import { Trophy, Star, MessageSquare } from 'lucide-react';

interface Props {
  rank: number;
  total: number;
  reviewsCount: number;
  rating: number;
}

const UserRanking: React.FC<Props> = ({ rank, total, reviewsCount, rating }) => {
  const pct = total > 0 ? ((1 - (rank - 1) / total) * 100).toFixed(0) : 0;

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
          <Trophy className="w-4 h-4 text-amber-600" />
        </div>
        <h3 className="font-semibold text-gray-900">Your Ranking</h3>
      </div>
      <div className="flex items-center justify-center gap-8 py-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-amber-500">#{rank}</p>
          <p className="text-xs text-gray-500 mt-1">of {total} jobseekers</p>
        </div>
        <div className="h-12 w-px bg-gray-200" />
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-lg font-bold text-gray-900">{rating.toFixed(1)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Average rating</p>
        </div>
        <div className="h-12 w-px bg-gray-200" />
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span className="text-lg font-bold text-gray-900">{reviewsCount}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Reviews</p>
        </div>
      </div>
      <div className="mt-2 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">Top {pct}%</span>
        </div>
      </div>
    </div>
  );
};

export default UserRanking;
