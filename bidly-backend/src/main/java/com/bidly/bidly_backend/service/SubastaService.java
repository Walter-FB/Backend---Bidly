package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.repository.AsistenteRepository;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.SubastaMonedaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class SubastaService {

    private static final Set<String> CATEGORIAS_ACCESO = Set.of(
        "comun", "especial", "plata", "oro", "platino"
    );

    @Autowired
    private SubastaMonedaRepository subastaMonedaRepository;

    @Autowired
    private ItemCatalogoRepository itemCatalogoRepository;

    @Autowired
    private AsistenteRepository asistenteRepository;

    public void enrich(Subasta s) {
        if (s == null) return;

        subastaMonedaRepository.findById(s.getIdentificador())
            .ifPresent(m -> s.setMoneda(m.getMoneda()));

        List<ItemCatalogo> items = itemCatalogoRepository.findBySubastaIdWithDetails(s.getIdentificador());
        s.setTotalItems(items.size());

        items.stream()
            .map(ItemCatalogo::getPrecioBase)
            .filter(p -> p != null)
            .min(Comparator.naturalOrder())
            .ifPresent(s::setPrecioBase);

        s.setTitulo(buildTitulo(s, items));
        s.setTotalAsistentes((long) asistenteRepository.findBySubastaIdentificador(s.getIdentificador()).size());
    }

    public void enrichAll(List<Subasta> lista) {
        lista.forEach(this::enrich);
    }

    private String buildTitulo(Subasta s, List<ItemCatalogo> items) {
        for (ItemCatalogo item : items) {
            String nombre = nombreProducto(item);
            if (nombre != null) {
                if (items.size() > 1) {
                    return nombre + " (+" + (items.size() - 1) + " ítems)";
                }
                return nombre;
            }
        }

        if (!items.isEmpty()) {
            ItemCatalogo primero = items.get(0);
            if (primero.getCatalogo() != null) {
                String catDesc = textoValido(primero.getCatalogo().getDescripcion());
                if (catDesc != null && !esCategoriaAcceso(catDesc)) {
                    return catDesc;
                }
            }
        }

        String ubi = tituloDesdeUbicacion(s.getUbicacion());
        if (ubi != null) return ubi;

        return "Subasta";
    }

    private String nombreProducto(ItemCatalogo item) {
        if (item.getProducto() == null) return null;
        return textoValido(item.getProducto().getDescripcionCatalogo());
    }

    private String textoValido(String texto) {
        if (texto == null) return null;
        String t = texto.trim();
        if (t.isEmpty() || t.equalsIgnoreCase("No Posee")) return null;
        return t;
    }

    private boolean esCategoriaAcceso(String texto) {
        return CATEGORIAS_ACCESO.contains(texto.toLowerCase(Locale.ROOT));
    }

    private String tituloDesdeUbicacion(String ubicacion) {
        String ubi = textoValido(ubicacion);
        if (ubi == null) return null;
        int guion = ubi.indexOf(" - ");
        if (guion > 0) return ubi.substring(0, guion).trim();
        int coma = ubi.indexOf(',');
        if (coma > 0) return ubi.substring(0, coma).trim();
        return ubi;
    }
}
