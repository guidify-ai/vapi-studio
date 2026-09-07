import { Navigate, Route, Routes } from 'react-router-dom';
import { StudioLayout } from './layout/StudioLayout';
import { FlowStudioPage } from './flow/FlowStudioPage';
import { ConversationsListPage } from './conversations/ConversationsListPage';
import { ConversationDetailPage } from './conversations/ConversationDetailPage';
import { AnalyticsPage } from './analytics/AnalyticsPage';

export function App() {
  return (
    <Routes>
      <Route element={<StudioLayout />}>
        <Route index element={<Navigate to="/flow" replace />} />
        <Route path="flow" element={<FlowStudioPage />} />
        <Route path="conversations" element={<ConversationsListPage />} />
        <Route path="conversations/:id" element={<ConversationDetailPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="*" element={<Navigate to="/flow" replace />} />
      </Route>
    </Routes>
  );
}
