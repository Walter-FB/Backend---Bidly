package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.model.SubastaEstadoAdmin;
import com.bidly.bidly_backend.repository.SubastaEstadoAdminRepository;
import com.bidly.bidly_backend.repository.SubastaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SubastaEstadoService {

    @Autowired
    private SubastaRepository subastaRepository;

    @Autowired
    private SubastaEstadoAdminRepository estadoAdminRepository;

    @Transactional
    public void aplicarEstado(Long subastaId, String estado) {
        int actualizadas = subastaRepository.updateEstadoSiFechaValida(subastaId, estado);
        if (actualizadas > 0) {
            estadoAdminRepository.findById(subastaId).ifPresent(estadoAdminRepository::delete);
            return;
        }
        SubastaEstadoAdmin override = estadoAdminRepository.findById(subastaId)
                .orElseGet(SubastaEstadoAdmin::new);
        override.setSubasta(subastaId);
        override.setEstado(estado);
        estadoAdminRepository.save(override);
    }

    public void aplicarOverrides(Collection<Subasta> subastas) {
        if (subastas == null || subastas.isEmpty()) return;
        List<Long> ids = subastas.stream().map(Subasta::getIdentificador).toList();
        Map<Long, String> overrides = estadoAdminRepository.findBySubastaIn(ids).stream()
                .collect(Collectors.toMap(SubastaEstadoAdmin::getSubasta, SubastaEstadoAdmin::getEstado));
        subastas.forEach(s -> {
            String estado = overrides.get(s.getIdentificador());
            if (estado != null) s.setEstado(estado);
        });
    }
}
