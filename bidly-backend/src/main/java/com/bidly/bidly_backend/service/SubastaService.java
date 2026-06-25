package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.model.SubastaSesion;
import com.bidly.bidly_backend.repository.AsistenteRepository;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.PujoFechaRepository;
import com.bidly.bidly_backend.repository.SubastaMonedaRepository;
import com.bidly.bidly_backend.repository.SubastaRepository;
import com.bidly.bidly_backend.repository.SubastaRevisionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class SubastaService {

    public static final String FASE_PENDIENTE = "pendiente";
    public static final String FASE_PROGRAMADA = "programada";
    public static final String FASE_EN_CURSO = "en_curso";
    public static final String FASE_FINALIZADA = "finalizada";
    public static final int MINUTOS_INACTIVIDAD = 30;

    private static final Set<String> CATEGORIAS_ACCESO = Set.of(
        "comun", "especial", "plata", "oro", "platino"
    );

    @Autowired
    private SubastaMonedaRepository subastaMonedaRepository;

    @Autowired
    private ItemCatalogoRepository itemCatalogoRepository;

    @Autowired
    private AsistenteRepository asistenteRepository;

    @Autowired
    private SubastaRevisionRepository revisionRepository;

    @Autowired
    private PujoFechaRepository pujoFechaRepository;

    @Autowired
    private SubastaRepository subastaRepository;

    @Autowired
    private SubastaEstadoService subastaEstadoService;

    @Autowired
    private SubastaSesionService subastaSesionService;

    public void enrich(Subasta s) {
        if (s == null) return;

        subastaEstadoService.aplicarOverrides(List.of(s));

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
        revisionRepository.findBySubastaIdentificador(s.getIdentificador())
                .ifPresent(r -> s.setRevisionEstado(r.getEstado()));

        enrichTiempo(s, items);
    }

    public void enrichAll(List<Subasta> lista) {
        subastaEstadoService.aplicarOverrides(lista);
        lista.forEach(this::enrich);
    }

    private void enrichTiempo(Subasta s, List<ItemCatalogo> items) {
        long pendientes = items.stream()
            .filter(i -> !"si".equals(i.getSubastado()))
            .count();
        s.setItemsPendientes((int) pendientes);
        boolean todosVendidos = !items.isEmpty() && pendientes == 0;

        String estadoSub = s.getEstadoSubasta() != null
                ? s.getEstadoSubasta()
                : subastaEstadoService.estadoSubasta(s.getIdentificador());
        if (s.getEstadoSubasta() == null) {
            s.setEstadoSubasta(estadoSub);
        }

        if (todosVendidos && SubastaEstadoService.INICIADA.equals(estadoSub)) {
            subastaEstadoService.finalizarSubasta(s.getIdentificador());
            estadoSub = SubastaEstadoService.FINALIZADA;
            s.setEstadoSubasta(estadoSub);
            s.setEstado("cerrada");
        }

        if (todosVendidos && SubastaEstadoService.FINALIZADA.equals(estadoSub)) {
            s.setFase(FASE_FINALIZADA);
            s.setSegundosRestantes(0L);
            return;
        }

        LocalDateTime ahora = LocalDateTime.now();

        switch (estadoSub) {
            case SubastaEstadoService.FINALIZADA -> {
                s.setFase(FASE_FINALIZADA);
                s.setSegundosRestantes(0L);
            }
            case SubastaEstadoService.INICIADA -> {
                s.setFase(FASE_EN_CURSO);
                LocalDateTime referencia = subastaSesionService.obtenerSesion(s.getIdentificador())
                        .map(SubastaSesion::getTimerDesde)
                        .orElseGet(() -> s.getFechaInicioReal() != null ? s.getFechaInicioReal() : ahora);
                LocalDateTime cierre = referencia.plusMinutes(MINUTOS_INACTIVIDAD);
                s.setSegundosRestantes(Math.max(0L, ChronoUnit.SECONDS.between(ahora, cierre)));
            }
            case SubastaEstadoService.PENDIENTE -> {
                s.setFase(FASE_PENDIENTE);
                s.setSegundosRestantes(null);
            }
            case SubastaEstadoService.ESPERANDO -> {
                s.setFase(FASE_PROGRAMADA);
                LocalDateTime inicio = inicioSubasta(s);
                if (inicio != null && inicio.isAfter(ahora)) {
                    s.setSegundosRestantes(ChronoUnit.SECONDS.between(ahora, inicio));
                } else {
                    s.setSegundosRestantes(0L);
                }
            }
            default -> {
                s.setFase(FASE_PROGRAMADA);
                s.setSegundosRestantes(0L);
            }
        }
    }

    public LocalDateTime referenciaInactividad(Subasta s, LocalDateTime ahora) {
        return pujoFechaRepository.findUltimaFechaBySubastaId(s.getIdentificador())
                .orElseGet(() -> {
                    if (s.getFechaInicioReal() != null) {
                        return s.getFechaInicioReal();
                    }
                    if (s.getFechaApertura() != null) {
                        return s.getFechaApertura();
                    }
                    return ahora;
                });
    }

    public boolean inactividadVencida(Subasta s, LocalDateTime ahora) {
        String estadoSub = s.getEstadoSubasta() != null
                ? s.getEstadoSubasta()
                : subastaEstadoService.estadoSubasta(s.getIdentificador());
        if (!SubastaEstadoService.INICIADA.equals(estadoSub)) {
            return false;
        }
        LocalDateTime referencia = subastaSesionService.obtenerSesion(s.getIdentificador())
                .map(SubastaSesion::getTimerDesde)
                .orElseGet(() -> referenciaInactividad(s, ahora));
        return !referencia.plusMinutes(MINUTOS_INACTIVIDAD).isAfter(ahora);
    }

    private LocalDateTime inicioSubasta(Subasta s) {
        if (s.getFecha() == null) return null;
        LocalTime hora = s.getHora() != null ? s.getHora() : LocalTime.MIDNIGHT;
        return LocalDateTime.of(s.getFecha(), hora);
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
