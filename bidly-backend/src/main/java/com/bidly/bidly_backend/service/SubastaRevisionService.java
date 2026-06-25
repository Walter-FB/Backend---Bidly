package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.model.SubastaRevision;
import com.bidly.bidly_backend.repository.SubastaRevisionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SubastaRevisionService {

    public static final String PENDIENTE = "pendiente";
    public static final String APROBADA = "aprobada";
    public static final String PAUSADA = "pausada";
    public static final String RECHAZADA = "rechazada";

    @Autowired
    private SubastaRevisionRepository revisionRepository;

    @Autowired
    private SubastaService subastaService;

    @Autowired
    private SubastaEstadoService subastaEstadoService;

    @Autowired
    private NotificacionService notificacionService;

    @Transactional
    public SubastaRevision registrarNueva(Subasta subasta) {
        SubastaRevision revision = new SubastaRevision();
        revision.setSubasta(subasta);
        revision.setSolicitante(subasta.getSubastador());
        revision.setEstado(PENDIENTE);
        revision.setFechaSolicitud(LocalDateTime.now());
        return revisionRepository.save(revision);
    }

    public List<SubastaRevision> listar(String estado) {
        List<SubastaRevision> lista;
        if (estado == null || estado.isBlank() || "pendiente".equals(estado)) {
            lista = revisionRepository.findByEstadosWithSubasta(List.of(PENDIENTE, PAUSADA));
        } else if ("todas".equals(estado)) {
            lista = revisionRepository.findAllWithSubasta();
        } else {
            lista = revisionRepository.findByEstadosWithSubasta(List.of(estado));
        }
        lista.forEach(r -> subastaService.enrich(r.getSubasta()));
        return lista;
    }

    public long contarPendientes() {
        return revisionRepository.countByEstado(PENDIENTE);
    }

    public List<Subasta> filtrarVisiblesPublico(List<Subasta> subastas) {
        if (subastas.isEmpty()) return subastas;
        List<Long> ids = subastas.stream().map(Subasta::getIdentificador).toList();
        Map<Long, String> estados = revisionRepository.findBySubastaIdentificadorIn(ids).stream()
                .collect(Collectors.toMap(
                        r -> r.getSubasta().getIdentificador(),
                        SubastaRevision::getEstado,
                        (a, b) -> a));
        return subastas.stream()
                .filter(s -> {
                    String est = estados.get(s.getIdentificador());
                    return est == null || APROBADA.equals(est);
                })
                .toList();
    }

    @Transactional
    public Optional<SubastaRevision> aprobar(Long subastaId) {
        return cambiarEstado(subastaId, APROBADA, false);
    }

    @Transactional
    public Optional<SubastaRevision> pausar(Long subastaId) {
        return cambiarEstado(subastaId, PAUSADA, true);
    }

    @Transactional
    public Optional<SubastaRevision> rechazar(Long subastaId, String observacion) {
        return revisionRepository.findBySubastaIdentificador(subastaId)
                .map(revision -> {
                    revision.setEstado(RECHAZADA);
                    revision.setFechaRevision(LocalDateTime.now());
                    if (observacion != null && !observacion.isBlank()) {
                        revision.setObservacion(observacion.trim());
                    }
                    Subasta subasta = revision.getSubasta();
                    subastaEstadoService.aplicarOverrides(List.of(subasta));
                    if (SubastaEstadoService.INICIADA.equals(subasta.getEstadoSubasta())) {
                        cerrarSubastaVivaRechazada(subasta, observacion);
                    } else if (SubastaEstadoService.PENDIENTE.equals(
                            subasta.getEstadoSubasta() != null
                                    ? subasta.getEstadoSubasta()
                                    : subastaEstadoService.estadoSubasta(subasta.getIdentificador()))
                            || SubastaEstadoService.ESPERANDO.equals(
                            subasta.getEstadoSubasta() != null
                                    ? subasta.getEstadoSubasta()
                                    : subastaEstadoService.estadoSubasta(subasta.getIdentificador()))) {
                        subastaEstadoService.finalizarSubasta(subasta.getIdentificador());
                        subasta.setEstado("cerrada");
                    }
                    return revisionRepository.save(revision);
                });
    }

    private void cerrarSubastaVivaRechazada(Subasta subasta, String observacion) {
        Long id = subasta.getIdentificador();
        String motivo = observacion != null && !observacion.isBlank()
                ? observacion.trim()
                : "Rechazada por moderación";
        notificacionService.notificarAsistentesSubasta(id, "subasta_rechazada",
                "La subasta #" + id + " fue cancelada por moderación. Motivo: " + motivo
                        + ". Las pujas registradas quedan sin efecto.");
        subastaEstadoService.finalizarSubasta(id);
        subasta.setEstado("cerrada");
    }

    private Optional<SubastaRevision> cambiarEstado(Long subastaId, String nuevoEstado, boolean forzarCerrada) {
        return revisionRepository.findBySubastaIdentificador(subastaId)
                .map(revision -> {
                    revision.setEstado(nuevoEstado);
                    revision.setFechaRevision(LocalDateTime.now());
                    if (APROBADA.equals(nuevoEstado)) {
                        subastaEstadoService.pasarAEsperando(subastaId);
                    }
                    if (forzarCerrada) {
                        Subasta subasta = revision.getSubasta();
                        subastaEstadoService.finalizarSubasta(subasta.getIdentificador());
                        subasta.setEstado("cerrada");
                    }
                    return revisionRepository.save(revision);
                });
    }
}
