import { Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
// @ts-expect-error fix inference
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
// @ts-expect-error fix inference
import { Slider } from "@/components/ui/slider"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

interface SearchParams {
  surface?: string
  covered?: boolean
  parking?: boolean
  maxPrice?: number
}

interface AdvancedFiltersSheetProps {
  searchParams: SearchParams
  updateSearchParams: (params: Partial<SearchParams>) => void
  activeFiltersCount: number
}

export function AdvancedFiltersSheet({
  searchParams,
  updateSearchParams,
  activeFiltersCount
}: AdvancedFiltersSheetProps) {
  return (
    <Sheet>
      {/* @ts-expect-error fix inference */}
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2 relative shrink-0">
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros Avanzados</span>
          {activeFiltersCount > 0 && (
            <Badge 
              variant="secondary" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs rounded-full"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros Avanzados</SheetTitle>
          <SheetDescription>
            Refina tu búsqueda para encontrar la cancha ideal.
          </SheetDescription>
        </SheetHeader>
        
        <div className="py-6 space-y-8">
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Tipo de Superficie</h4>
            <div className="flex flex-wrap gap-2">
              {['Sintético', 'Cemento', 'Parquet'].map((surface) => (
                <Badge
                  key={surface}
                  variant={searchParams.surface === surface.toLowerCase() ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/90 hover:text-primary-foreground px-3 py-1"
                  onClick={() => updateSearchParams({ 
                    surface: searchParams.surface === surface.toLowerCase() ? undefined : surface.toLowerCase() 
                  })}
                >
                  {surface}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Precio Máximo</h4>
            <div className="pt-4 px-2">
              <Slider
                defaultValue={[searchParams.maxPrice || 50000]}
                max={50000}
                min={5000}
                step={1000}
                // @ts-expect-error fix inference
                onValueChange={(val) => updateSearchParams({ maxPrice: val[0] })}
              />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>$5.000</span>
                <span>${(searchParams.maxPrice || 50000).toLocaleString('es-AR')}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Comodidades</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cancha Techada</Label>
                  <p className="text-xs text-muted-foreground">Solo mostrar canchas con techo</p>
                </div>
                <Switch 
                  checked={searchParams.covered || false}
                  // @ts-expect-error fix inference
                  onCheckedChange={(checked) => updateSearchParams({ covered: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Estacionamiento</Label>
                  <p className="text-xs text-muted-foreground">Complejos con parking propio</p>
                </div>
                <Switch 
                  checked={searchParams.parking || false}
                  // @ts-expect-error fix inference
                  onCheckedChange={(checked) => updateSearchParams({ parking: checked })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t mt-auto">
          <Button 
            className="w-full" 
            variant="outline"
            onClick={() => updateSearchParams({ 
              surface: undefined, 
              covered: undefined, 
              parking: undefined, 
              maxPrice: undefined 
            })}
          >
            Limpiar Filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
