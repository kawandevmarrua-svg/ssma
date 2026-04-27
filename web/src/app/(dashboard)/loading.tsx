export default function DashboardLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    </div>
  );
}
